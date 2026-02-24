import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  UpdateProfileDto,
  UpdatePsychProfileDto,
} from './dto/update-profile.dto';
import { hash, compare } from 'bcryptjs';
import { pickRandomAvatarFromBatch } from '../../common/utils/avatar.util';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private static readonly PROFILE_COMPLETE_FIELDS: (keyof UpdateProfileDto)[] = [
    'gender',
    'birthDate',
    'city',
    'province',
    'bio',
  ];

  constructor(private prisma: PrismaService) {}

  private async awardCreditOnce(
    userId: string,
    actionType: string,
    scoreChange: number,
    reason: string,
  ) {
    const existing = await this.prisma.creditLog.findFirst({
      where: { userId, actionType },
      select: { id: true },
    });
    if (existing) return null;

    const [, creditScore] = await this.prisma.$transaction([
      this.prisma.creditLog.create({
        data: { userId, actionType, scoreChange, reason },
      }),
      this.prisma.creditScore.update({
        where: { userId },
        data: { score: { increment: scoreChange } },
      }),
    ]);

    const newLevel = this.computeLevel(creditScore.score);
    if (creditScore.level !== newLevel) {
      await this.prisma.creditScore.update({
        where: { userId },
        data: { level: newLevel },
      });
    }
    return { score: creditScore.score, level: newLevel };
  }

  async getLiveStats(userId: string) {
    const [onlineUsers, todayMatches, activeConversations, pendingMatches] =
      await Promise.all([
        this.prisma.user.count({ where: { status: 'ACTIVE', role: 'USER' } }),
        this.prisma.match.count({
          where: { createdAt: { gte: this.todayStart() } },
        }),
        this.prisma.conversation.count({ where: { status: 'ACTIVE' } }),
        this.prisma.match.count({
          where: {
            OR: [{ userAId: userId }, { userBId: userId }],
            status: 'PENDING',
          },
        }),
      ]);

    const myProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    let insightText = '完成性格测试，开始你的灵魂匹配之旅';
    if (myProfile?.testCompleted) {
      const typeInsights: Record<string, string> = {
        SECURE:
          '你的安全型依恋风格让你在关系中更加稳定，今日匹配侧重深度连接者',
        ANXIOUS: '你对亲密关系的渴望是优势，今日为你匹配了善于回应的伙伴',
        AVOIDANT: '独立是你的魅力，今日推荐了同样重视个人空间的灵魂',
        FEARFUL: '你的敏感是独特的礼物，今日匹配了温暖包容的灵魂',
      };
      insightText =
        typeInsights[myProfile.attachmentType || ''] ||
        '你的灵魂频率已更新，今日推荐准确率预计提升';
    }

    return {
      onlineUsers,
      todayMatches,
      activeConversations,
      pendingMatches,
      insight: insightText,
      matchHint:
        pendingMatches > 0
          ? `${pendingMatches} 位灵魂正在等待你的回应`
          : `${Math.max(1, Math.floor(onlineUsers * 0.03))} 位灵魂正在你的频率上共振`,
    };
  }

  async dailyCheckin(userId: string) {
    const today = this.todayStart();
    const existing = await this.prisma.creditLog.findFirst({
      where: { userId, actionType: 'DAILY_CHECKIN', createdAt: { gte: today } },
    });
    if (existing) throw new BadRequestException('今日已签到');

    const [, creditScore] = await this.prisma.$transaction([
      this.prisma.creditLog.create({
        data: {
          userId,
          actionType: 'DAILY_CHECKIN',
          scoreChange: 2,
          reason: '每日签到',
        },
      }),
      this.prisma.creditScore.update({
        where: { userId },
        data: { score: { increment: 2 } },
      }),
    ]);

    const newLevel = this.computeLevel(creditScore.score);
    if (creditScore.level !== newLevel) {
      await this.prisma.creditScore.update({
        where: { userId },
        data: { level: newLevel },
      });
    }

    return {
      success: true,
      scoreChange: 2,
      newScore: creditScore.score,
      level: newLevel,
      message: '签到成功 +2 信用分',
    };
  }

  async getCreditHistory(userId: string) {
    const logs = await this.prisma.creditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const creditScore = await this.prisma.creditScore.findUnique({
      where: { userId },
    });
    const todayChecked = await this.prisma.creditLog.findFirst({
      where: {
        userId,
        actionType: 'DAILY_CHECKIN',
        createdAt: { gte: this.todayStart() },
      },
    });

    const score = creditScore?.score ?? 0;
    const correctLevel = this.computeLevel(score);

    if (creditScore && creditScore.level !== correctLevel) {
      await this.prisma.creditScore.update({
        where: { userId },
        data: { level: correctLevel },
      });
    }

    return {
      logs,
      currentScore: score,
      level: correctLevel,
      todayChecked: !!todayChecked,
    };
  }

  async getUnreadCounts(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { match: { OR: [{ userAId: userId }, { userBId: userId }] } },
      include: {
        messages: {
          where: { senderId: { not: userId }, readAt: null },
          select: { id: true },
        },
      },
    });
    const totalUnread = conversations.reduce(
      (s, c) => s + c.messages.length,
      0,
    );
    const byConversation = Object.fromEntries(
      conversations.map((c) => [c.id, c.messages.length]),
    );
    return { totalUnread, byConversation };
  }

  async getOperationalMessages() {
    return this.prisma.operationalMessage.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
  }

  private computeLevel(
    score: number,
  ): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
    if (score >= 95) return 'PLATINUM';
    if (score >= 80) return 'GOLD';
    if (score >= 60) return 'SILVER';
    return 'BRONZE';
  }

  private todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        nickname: true,
        avatar: true,
        gender: true,
        birthDate: true,
        bio: true,
        city: true,
        province: true,
        createdAt: true,
        profile: {
          select: {
            attachmentType: true,
            communicationStyle: true,
            personalityTags: true,
            valuesVector: true,
            aiSummary: true,
            testCompleted: true,
          },
        },
        creditScore: {
          select: { score: true, level: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    let ensuredAvatar = user.avatar;
    if (!ensuredAvatar) {
      ensuredAvatar = pickRandomAvatarFromBatch(user.nickname || 'LinkSoul', {
        perStyle: 4,
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: ensuredAvatar },
      });
    }
    const score = user.creditScore?.score ?? 0;
    const correctLevel = this.computeLevel(score);

    if (user.creditScore && user.creditScore.level !== correctLevel) {
      await this.prisma.creditScore.update({
        where: { userId },
        data: { level: correctLevel },
      });
      return {
        ...user,
        avatar: ensuredAvatar,
        creditScore: {
          ...user.creditScore,
          level: correctLevel,
        },
      };
    }

    return {
      ...user,
      avatar: ensuredAvatar,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const has = (key: keyof UpdateProfileDto) =>
      Object.prototype.hasOwnProperty.call(dto, key);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: has('nickname') ? (dto.nickname as any) : undefined,
        avatar: has('avatar') ? (dto.avatar as any) : undefined,
        gender: has('gender') ? ((dto.gender as any) ?? null) : undefined,
        birthDate: has('birthDate')
          ? dto.birthDate
            ? new Date(dto.birthDate)
            : null
          : undefined,
        bio: has('bio') ? (dto.bio as any) : undefined,
        city: has('city') ? (dto.city as any) : undefined,
        province: has('province') ? (dto.province as any) : undefined,
      },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        gender: true,
        birthDate: true,
        bio: true,
        city: true,
        province: true,
      },
    });

    const profileCompleted = UsersService.PROFILE_COMPLETE_FIELDS.every((key) => {
      const value = updated[key];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
    if (profileCompleted) {
      await this.awardCreditOnce(userId, 'COMPLETE_PROFILE', 10, '完善个人资料');
    }

    return updated;
  }

  async updatePsychProfile(userId: string, dto: UpdatePsychProfileDto) {
    return this.prisma.userProfile.update({
      where: { userId },
      data: {
        attachmentType: dto.attachmentType as any,
        communicationStyle: dto.communicationStyle as any,
        personalityTags: dto.personalityTags
          ? JSON.stringify(dto.personalityTags)
          : undefined,
        testCompleted: true,
      },
    });
  }

  async submitPersonalityTest(userId: string, answers: Record<string, any>) {
    const localResult = this.calculatePersonalityResult(answers);

    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        attachmentType: localResult.attachmentType as any,
        communicationStyle: localResult.communicationStyle as any,
        personalityTags: JSON.stringify(localResult.personalityTags),
        valuesVector: JSON.stringify(localResult.dimensionDetails),
        testCompleted: true,
      },
    });

    this.callAiAnalysis(userId, answers).catch((err) =>
      this.logger.warn(`AI personality analysis failed: ${err.message}`),
    );

    await this.awardCreditOnce(
      userId,
      'PERSONALITY_TEST',
      15,
      '完成性格测试',
    );

    return localResult;
  }

  private async callAiAnalysis(userId: string, answers: Record<string, any>) {
    try {
      const resp = await fetch(`${AI_SERVICE_URL}/api/v1/personality/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (!resp.ok) return;

      const aiResult = await resp.json();

      await this.prisma.userProfile.update({
        where: { userId },
        data: {
          attachmentType: aiResult.attachment_type,
          communicationStyle: aiResult.communication_style,
          personalityTags: JSON.stringify(aiResult.personality_tags || []),
          aiSummary: aiResult.ai_summary || null,
        },
      });

      this.logger.log(`AI personality analysis completed for user ${userId}`);
    } catch {
      this.logger.warn(`AI service unreachable for personality analysis`);
    }
  }

  private calculatePersonalityResult(answers: Record<string, any>) {
    const anxietyKeys = ['q1', 'q2', 'q3', 'q4'];
    const avoidanceKeys = ['q5', 'q6', 'q7', 'q8'];

    const avg = (keys: string[]) =>
      keys.reduce((sum, k) => sum + (Number(answers[k]) || 3), 0) / keys.length;

    const anxiety = avg(anxietyKeys);
    const avoidance = avg(avoidanceKeys);

    let attachmentType: string;
    if (anxiety <= 3 && avoidance <= 3) attachmentType = 'SECURE';
    else if (anxiety > 3 && avoidance <= 3) attachmentType = 'ANXIOUS';
    else if (anxiety <= 3 && avoidance > 3) attachmentType = 'AVOIDANT';
    else attachmentType = 'FEARFUL';

    const directness = (Number(answers.q9 || 3) + Number(answers.q10 || 3)) / 2;
    const emotionality =
      (Number(answers.q11 || 3) + Number(answers.q12 || 3)) / 2;
    const analyticity =
      (Number(answers.q13 || 3) + Number(answers.q14 || 3)) / 2;
    const indirectness = 6 - directness;

    const commScores = {
      DIRECT: directness,
      EMOTIONAL: emotionality,
      ANALYTICAL: analyticity,
      INDIRECT: indirectness,
    };
    const communicationStyle = Object.entries(commScores).sort(
      ([, a], [, b]) => b - a,
    )[0][0];

    const tags: string[] = [];
    if (Number(answers.q15 || 3) >= 4) tags.push('开放探索');
    if (Number(answers.q15 || 3) <= 2) tags.push('稳重务实');
    if (Number(answers.q16 || 3) >= 4) tags.push('享受独处');
    if (Number(answers.q17 || 3) >= 4) tags.push('高共情力');
    if (Number(answers.q18 || 3) >= 4) tags.push('条理清晰');
    if (Number(answers.q19 || 3) >= 4) tags.push('社交达人');
    if (Number(answers.q19 || 3) <= 2) tags.push('内敛安静');
    if (Number(answers.q20 || 3) >= 4) tags.push('深度社交');
    if (Number(answers.q20 || 3) <= 2) tags.push('广泛社交');
    if (tags.length === 0) tags.push('均衡型');

    return {
      attachmentType,
      communicationStyle,
      personalityTags: tags,
      dimensionDetails: {
        attachment: {
          anxiety: Math.round(anxiety * 100) / 100,
          avoidance: Math.round(avoidance * 100) / 100,
        },
        communication: {
          directness: Math.round(directness * 100) / 100,
          emotionality: Math.round(emotionality * 100) / 100,
          analyticity: Math.round(analyticity * 100) / 100,
        },
      },
    };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    if (!oldPassword || !newPassword)
      throw new BadRequestException('密码不能为空');
    if (newPassword.length < 6)
      throw new BadRequestException('新密码至少 6 位');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');

    const valid = await compare(oldPassword, user.password);
    if (!valid) throw new BadRequestException('原密码不正确');

    const hashed = await hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return { message: '密码修改成功' };
  }

  async createReport(
    reporterId: string,
    reportedId: string,
    reason: string,
    detail?: string,
  ) {
    if (reporterId === reportedId)
      throw new BadRequestException('不能举报自己');
    if (!reason?.trim()) throw new BadRequestException('举报原因不能为空');

    const reported = await this.prisma.user.findUnique({
      where: { id: reportedId },
    });
    if (!reported) throw new NotFoundException('被举报用户不存在');

    return this.prisma.report.create({
      data: { reporterId, reportedId, reason, detail: detail || null },
    });
  }
}
