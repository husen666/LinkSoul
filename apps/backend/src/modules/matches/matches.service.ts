import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

interface CandidateProfile {
  attachmentType?: string | null;
  personalityTags?: string | null;
}

interface CandidateUser {
  id: string;
  nickname: string;
  avatar: string | null;
  gender: string | null;
  bio: string | null;
  city: string | null;
  birthDate: Date | null;
  profile: CandidateProfile | null;
}

export interface MatchRecommendation {
  userId: string;
  nickname: string;
  avatar: string | null;
  gender: string | null;
  bio: string | null;
  city: string | null;
  age: number | null;
  score: number;
  matchReason: string;
}

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getDailyRecommendations(userId: string) {
    const cacheKey = `match:daily:${userId}`;
    const cached = await this.redis.getJson<MatchRecommendation[]>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // MVP: basic matching using profile attributes
    const candidates = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        status: 'ACTIVE',
        profile: { testCompleted: true },
      },
      include: { profile: true },
      take: 10,
    });

    const recommendations = candidates.map((candidate) => ({
      userId: candidate.id,
      nickname: candidate.nickname,
      avatar: candidate.avatar,
      gender: candidate.gender,
      bio: candidate.bio,
      city: candidate.city,
      age: candidate.birthDate
        ? Math.floor((Date.now() - candidate.birthDate.getTime()) / 31557600000)
        : null,
      score: this.calculateMatchScore(user, candidate),
      matchReason: this.generateMatchReason(user, candidate),
    }));

    recommendations.sort((a, b) => b.score - a.score);

    await this.redis.setJson(cacheKey, recommendations, 86400);

    return recommendations;
  }

  async acceptMatch(userId: string, targetUserId: string, superLike = false) {
    if (userId === targetUserId) {
      throw new ForbiddenException('不能与自己匹配');
    }

    const existingMatch = await this.prisma.match.findFirst({
      where: {
        OR: [
          { userAId: userId, userBId: targetUserId },
          { userAId: targetUserId, userBId: userId },
        ],
      },
    });

    if (existingMatch) {
      // First accept only creates pending intent; reciprocal accept upgrades to ACCEPTED.
      if (
        existingMatch.userAId === userId &&
        existingMatch.userBId === targetUserId
      ) {
        return existingMatch;
      }

      const bonus = superLike ? 10 : 0;
      const result = await this.prisma.$transaction(async (tx) => {
        const match = await tx.match.update({
          where: { id: existingMatch.id },
          data: {
            status: 'ACCEPTED',
            score: Math.min(existingMatch.score + bonus, 100),
            matchReason: superLike
              ? '✦ 量子共振匹配（双向确认）'
              : `${existingMatch.matchReason || '用户发起匹配'}；双向确认达成`,
          },
        });

        const conv = await tx.conversation.findUnique({
          where: { matchId: match.id },
        });
        if (!conv) {
          await tx.conversation.create({
            data: { matchId: match.id, type: 'DIRECT', status: 'ACTIVE' },
          });
        }
        return match;
      });
      return result;
    }

    const score = await this.getMatchScore(userId, targetUserId);
    const bonus = superLike ? 10 : 0;

    const match = await this.prisma.match.create({
      data: {
        userAId: userId,
        userBId: targetUserId,
        score: Math.min(score + bonus, 100),
        status: superLike ? 'ACCEPTED' : 'PENDING',
        matchReason: superLike
          ? '✦ 量子共振匹配（单向强意愿）'
          : '用户发起匹配，等待对方确认',
      },
    });

    if (match.status === 'ACCEPTED') {
      await this.ensureConversation(match.id);
    }

    return match;
  }

  private async ensureConversation(matchId: string) {
    const existing = await this.prisma.conversation.findUnique({
      where: { matchId },
    });
    if (!existing) {
      await this.prisma.conversation.create({
        data: { matchId, type: 'DIRECT', status: 'ACTIVE' },
      });
    }
  }

  async rejectMatch(userId: string, targetUserId: string) {
    const match = await this.prisma.match.findFirst({
      where: {
        OR: [
          { userAId: userId, userBId: targetUserId },
          { userAId: targetUserId, userBId: userId },
        ],
      },
    });

    if (match) {
      return this.prisma.match.update({
        where: { id: match.id },
        data: { status: 'REJECTED' },
      });
    }

    return { message: 'No match found to reject' };
  }

  async getMyMatches(userId: string) {
    const rows = await this.prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: { id: true, nickname: true, avatar: true } },
        userB: { select: { id: true, nickname: true, avatar: true } },
        conversation: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rank: Record<string, number> = {
      ACCEPTED: 4,
      PENDING: 3,
      REJECTED: 2,
      EXPIRED: 1,
    };
    const bestByOther = new Map<string, (typeof rows)[number]>();

    for (const row of rows) {
      const otherId = row.userAId === userId ? row.userBId : row.userAId;
      const prev = bestByOther.get(otherId);
      if (!prev) {
        bestByOther.set(otherId, row);
        continue;
      }
      const prevRank = rank[prev.status] || 0;
      const curRank = rank[row.status] || 0;
      const prevHasConv = !!prev.conversation?.id;
      const curHasConv = !!row.conversation?.id;

      if (
        curRank > prevRank ||
        (curRank === prevRank && curHasConv && !prevHasConv) ||
        (curRank === prevRank &&
          curHasConv === prevHasConv &&
          row.updatedAt > prev.updatedAt)
      ) {
        bestByOther.set(otherId, row);
      }
    }

    return Array.from(bestByOther.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  async getMatchAnalysis(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
        relationship: true,
      },
    });
    if (!match) throw new NotFoundException('匹配不存在');
    if (match.userAId !== userId && match.userBId !== userId) {
      throw new ForbiddenException('无权查看该匹配分析');
    }

    const msgCount = await this.prisma.message.count({
      where: { conversation: { matchId } },
    });

    const ATTACH_COMPAT: Record<string, Record<string, number>> = {
      SECURE: { SECURE: 95, ANXIOUS: 80, AVOIDANT: 70, FEARFUL: 65 },
      ANXIOUS: { SECURE: 80, ANXIOUS: 55, AVOIDANT: 35, FEARFUL: 45 },
      AVOIDANT: { SECURE: 70, ANXIOUS: 35, AVOIDANT: 60, FEARFUL: 40 },
      FEARFUL: { SECURE: 65, ANXIOUS: 45, AVOIDANT: 40, FEARFUL: 30 },
    };
    const attachA = match.userA.profile?.attachmentType || 'SECURE';
    const attachB = match.userB.profile?.attachmentType || 'SECURE';
    const attachCompat = ATTACH_COMPAT[attachA]?.[attachB] ?? 50;

    const tagsA = this.parseTags(match.userA.profile?.personalityTags);
    const tagsB = this.parseTags(match.userB.profile?.personalityTags);
    const commonTags = tagsA.filter((t) => tagsB.includes(t));

    const strengths: string[] = [];
    const challenges: string[] = [];

    if (attachCompat >= 70) strengths.push('依恋模式互补性好，关系基础稳固');
    else challenges.push('依恋模式差异较大，需要更多理解和包容');

    if (commonTags.length >= 2)
      strengths.push(`共同特质多 (${commonTags.join('、')})，容易产生共鸣`);
    if (match.userA.city === match.userB.city && match.userA.city)
      strengths.push('同城关系，见面更方便');

    const commA = match.userA.profile?.communicationStyle;
    const commB = match.userB.profile?.communicationStyle;
    if (commA === commB) strengths.push('沟通风格一致，交流更顺畅');
    else challenges.push('沟通风格不同，建议多关注对方的表达方式');

    if (msgCount > 20) strengths.push('互动频繁，关系活跃度高');
    else if (msgCount < 5) challenges.push('互动较少，建议增加交流频率');

    return {
      matchId,
      score: Math.round(match.score),
      attachmentCompatibility: attachCompat,
      commonTags,
      messageCount: msgCount,
      relationshipStage: match.relationship?.stage || 'INITIAL',
      strengths,
      challenges,
      suggestion:
        strengths.length > challenges.length
          ? '你们的契合度较高，继续保持真诚的沟通会让关系更进一步'
          : '虽然存在一些差异，但差异也是互相学习成长的机会',
      userA: {
        nickname: match.userA.nickname,
        attachmentType: attachA,
        communicationStyle: commA,
      },
      userB: {
        nickname: match.userB.nickname,
        attachmentType: attachB,
        communicationStyle: commB,
      },
    };
  }

  private calculateMatchScore(
    user: CandidateUser,
    candidate: CandidateUser,
  ): number {
    let score = 50;

    if (user.profile?.attachmentType && candidate.profile?.attachmentType) {
      if (user.profile.attachmentType === candidate.profile.attachmentType) {
        score += 20;
      } else if (
        user.profile.attachmentType === 'SECURE' ||
        candidate.profile.attachmentType === 'SECURE'
      ) {
        score += 15;
      }
    }

    if (user.city && candidate.city && user.city === candidate.city) {
      score += 10;
    }

    const userTags = this.parseTags(user.profile?.personalityTags);
    const candidateTags = this.parseTags(candidate.profile?.personalityTags);
    const commonTags = userTags.filter((tag: string) =>
      candidateTags.includes(tag),
    );
    score += commonTags.length * 5;

    return Math.min(score, 100);
  }

  private generateMatchReason(
    user: CandidateUser,
    candidate: CandidateUser,
  ): string {
    const reasons: string[] = [];

    if (user.profile?.attachmentType === candidate.profile?.attachmentType) {
      reasons.push('Similar attachment style');
    }

    if (user.city && candidate.city && user.city === candidate.city) {
      reasons.push('Same city');
    }

    const userTags = this.parseTags(user.profile?.personalityTags);
    const candidateTags = this.parseTags(candidate.profile?.personalityTags);
    const commonTags = userTags.filter((tag: string) =>
      candidateTags.includes(tag),
    );
    if (commonTags.length > 0) {
      reasons.push(`Shared traits: ${commonTags.join(', ')}`);
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Compatible profiles';
  }

  private async getMatchScore(
    userAId: string,
    userBId: string,
  ): Promise<number> {
    const [userA, userB] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userAId },
        include: { profile: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userBId },
        include: { profile: true },
      }),
    ]);
    if (!userA || !userB) return 50;
    return this.calculateMatchScore(userA, userB);
  }

  private parseTags(raw: string | string[] | null | undefined): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string');
      }
      return [];
    } catch {
      return [];
    }
  }
}
