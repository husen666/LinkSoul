import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

interface PlayModeProfile {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: string;
  tags: string[];
}

interface PlayModeStat {
  opens: number;
  runs: number;
  success: number;
  fail: number;
  lastRunAt: string | null;
}

interface PlayModeRankItem extends PlayModeProfile {
  score: number;
  hotRank: number;
  reason: string;
  stageFit: RelationshipStage;
  stat: PlayModeStat;
}

type RelationshipStage = 'GETTING_TO_KNOW' | 'WARMING_UP' | 'STABLE';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private readonly allowedTypes = new Set([
    'TEXT',
    'IMAGE',
    'VIDEO',
    'FILE',
    'EMOJI',
    'VOICE',
    'SYSTEM',
    'AI_SUGGESTION',
  ]);
  private readonly playModes: PlayModeProfile[] = [
    {
      key: 'ai-avatar',
      title: 'AI 分身对话',
      subtitle: '先和分身试聊，减少破冰压力',
      icon: 'person-circle-outline',
      tone: '#A78BFA',
      tags: ['ai', 'icebreak'],
    },
    {
      key: 'co-create',
      title: '双人共创',
      subtitle: '一起完成故事/清单/计划',
      icon: 'color-wand-outline',
      tone: '#22D3EE',
      tags: ['task', 'create'],
    },
    {
      key: 'resonance-room',
      title: '情绪共振房间',
      subtitle: '匿名同频主题，限时互动',
      icon: 'radio-outline',
      tone: '#F472B6',
      tags: ['emotion', 'anon'],
    },
    {
      key: 'voice-caption',
      title: '语音字幕聊天',
      subtitle: '语音优先，自动生成摘要',
      icon: 'mic-outline',
      tone: '#FB7185',
      tags: ['voice', 'light'],
    },
    {
      key: 'date-planner',
      title: 'AI 约会策划',
      subtitle: '自动生成见面方案与话题卡',
      icon: 'calendar-outline',
      tone: '#FBBF24',
      tags: ['ai', 'offline'],
    },
    {
      key: 'growth-tree',
      title: '关系成长树',
      subtitle: '可视化关系温度与互动趋势',
      icon: 'git-network-outline',
      tone: '#34D399',
      tags: ['insight', 'relationship'],
    },
    {
      key: 'weekly-check',
      title: '每周关系体检',
      subtitle: '沟通质量周报 + 建议一句话',
      icon: 'pulse-outline',
      tone: '#60A5FA',
      tags: ['insight', 'weekly'],
    },
    {
      key: 'real-challenge',
      title: '现实联动挑战',
      subtitle: '线上协作 + 线下任务打卡',
      icon: 'footsteps-outline',
      tone: '#F97316',
      tags: ['offline', 'task'],
    },
    {
      key: 'privacy-layers',
      title: '隐私分层社交',
      subtitle: '公开/半匿名/匿名快速切换',
      icon: 'shield-checkmark-outline',
      tone: '#818CF8',
      tags: ['privacy', 'safety'],
    },
    {
      key: 'awkward-rescue',
      title: '防尬救援',
      subtitle: '聊天卡住时，一键续聊建议',
      icon: 'sparkles-outline',
      tone: '#EC4899',
      tags: ['ai', 'icebreak'],
    },
  ];

  private validateMessagePayload(
    content: string,
    type: string,
    media?: {
      mediaUrl?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    },
  ) {
    if (!this.allowedTypes.has(type)) {
      throw new BadRequestException('不支持的消息类型');
    }
    const trimmed = (content || '').trim();
    if (trimmed.length === 0 && !media?.mediaUrl) {
      throw new BadRequestException('消息内容不能为空');
    }
    if (trimmed.length > 2000) {
      throw new BadRequestException('消息内容过长');
    }
    if (media?.fileSize && media.fileSize > 50 * 1024 * 1024) {
      throw new BadRequestException('文件大小不能超过 50MB');
    }

    if (type === 'EMOJI' && trimmed.length > 16) {
      throw new BadRequestException('表情消息过长');
    }
    if (
      type === 'IMAGE' ||
      type === 'VIDEO' ||
      type === 'FILE' ||
      type === 'VOICE'
    ) {
      if (!media?.mediaUrl) {
        throw new BadRequestException('该消息类型必须包含媒体地址');
      }
    }
  }

  async getOrCreateConversation(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) throw new NotFoundException('Match not found');
    if (match.userAId !== userId && match.userBId !== userId) {
      throw new ForbiddenException('Not part of this match');
    }

    let conversation = await this.prisma.conversation.findUnique({
      where: { matchId },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          matchId,
          type: 'AI_PRECHAT',
          status: 'ACTIVE',
        },
      });
    }

    return conversation;
  }

  async getConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        match: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: 'ACCEPTED',
        },
      },
      include: {
        match: {
          include: {
            userA: { select: { id: true, nickname: true, avatar: true } },
            userB: { select: { id: true, nickname: true, avatar: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, senderId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50,
  ) {
    await this.assertConversationMember(conversationId, userId);

    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        mediaUrl: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        type: true,
        senderId: true,
        aiSuggested: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async getPlayLabModes(userId: string, conversationId?: string) {
    if (conversationId) {
      await this.assertConversationMember(conversationId, userId);
    }
    const globalStats = await this.getPlayStatsFromCache('chat:play:global');
    const userStats = await this.getPlayStatsFromCache(`chat:play:user:${userId}`);
    const stage = await this.detectRelationshipStage(userId, conversationId);
    const profileBoost = await this.computeProfileBoost(userId, conversationId, stage);
    const maxGlobal = Math.max(
      1,
      ...Object.values(globalStats).map((v) => v.runs || 0),
    );
    const maxUser = Math.max(
      1,
      ...Object.values(userStats).map((v) => v.runs || 0),
    );

    const ranked = this.playModes
      .map((mode) => {
        const g = this.normalizePlayModeStat(globalStats[mode.key]);
        const u = this.normalizePlayModeStat(userStats[mode.key]);
        const gHot = g.runs / maxGlobal;
        const uPref = u.runs / maxUser;
        const successRate = u.runs > 0 ? u.success / u.runs : 0;
        const boost = profileBoost[mode.key] || 0;
        const score = Number(
          (uPref * 0.48 + gHot * 0.32 + successRate * 0.1 + boost * 0.1).toFixed(4),
        );
        const reason = this.buildReason(mode, u, g, boost);
        return {
          ...mode,
          score,
          reason,
          stageFit: this.getModeStageFit(mode),
          hotRank: 0,
          stat: {
            opens: u.opens,
            runs: u.runs,
            success: u.success,
            fail: u.fail,
            lastRunAt: u.lastRunAt,
          },
        };
      })
      .sort((a, b) => b.score - a.score);

    const hot = [...ranked]
      .sort((a, b) => {
        const ga = globalStats[a.key]?.runs || 0;
        const gb = globalStats[b.key]?.runs || 0;
        return gb - ga || b.score - a.score;
      })
      .map((item, idx) => ({ ...item, hotRank: idx + 1 }));

    const hotMap = new Map<string, number>(hot.map((h) => [h.key, h.hotRank]));
    const recommended = ranked.map((item) => ({
      ...item,
      hotRank: hotMap.get(item.key) || 0,
    }));

    return {
      recommended,
      hot,
      meta: {
        globalEvents: Object.values(globalStats).reduce((sum, v) => sum + (v.runs || 0), 0),
        userEvents: Object.values(userStats).reduce((sum, v) => sum + (v.runs || 0), 0),
        relationshipStage: stage,
        funnel: this.buildFunnelMeta(globalStats, userStats),
      },
    };
  }

  async trackPlayModeEvent(
    userId: string,
    modeKey: string,
    event: 'open' | 'run' | 'success' | 'fail',
    conversationId?: string,
  ) {
    const mode = this.playModes.find((m) => m.key === modeKey);
    if (!mode) throw new BadRequestException('未知玩法');
    if (conversationId) {
      await this.assertConversationMember(conversationId, userId);
    }
    const shouldCountOpen = event === 'open';
    const shouldCountRun = event === 'run';
    const shouldCountSuccess = event === 'success';
    const shouldCountFail = event === 'fail';
    await this.bumpPlayStats(
      'chat:play:global',
      modeKey,
      shouldCountOpen,
      shouldCountRun,
      shouldCountSuccess,
      shouldCountFail,
    );
    await this.bumpPlayStats(
      `chat:play:user:${userId}`,
      modeKey,
      shouldCountOpen,
      shouldCountRun,
      shouldCountSuccess,
      shouldCountFail,
    );
    return { ok: true };
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: string = 'TEXT',
    aiSuggested = false,
    media?: {
      mediaUrl?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    },
  ) {
    this.validateMessagePayload(content, type, media);
    await this.assertConversationMember(conversationId, senderId);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        mediaUrl: media?.mediaUrl || null,
        fileName: media?.fileName || null,
        mimeType: media?.mimeType || null,
        fileSize: media?.fileSize || null,
        type: type as any,
        aiSuggested,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    this.tryChatCreditReward(senderId).catch(() => {});

    return message;
  }

  async deleteMessage(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true },
    });
    if (!msg) throw new NotFoundException('Message not found');

    await this.assertConversationMember(msg.conversationId, userId);
    if (msg.senderId !== userId) {
      throw new ForbiddenException('Only sender can delete message');
    }

    await this.prisma.message.delete({ where: { id: messageId } });
    return { deleted: true, id: messageId, conversationId: msg.conversationId };
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.assertConversationMember(conversationId, userId);

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  async setOnlineStatus(userId: string, online: boolean) {
    if (online) {
      await this.redis.set(`chat:online:${userId}`, '1', 300);
    } else {
      await this.redis.del(`chat:online:${userId}`);
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    const status = await this.redis.get(`chat:online:${userId}`);
    return !!status;
  }

  async assertConversationMember(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { match: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (
      conversation.match.userAId !== userId &&
      conversation.match.userBId !== userId
    ) {
      throw new ForbiddenException('Not part of this conversation');
    }
    return conversation;
  }

  private async tryChatCreditReward(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = await this.prisma.creditLog.count({
      where: { userId, actionType: 'CHAT_ACTIVE', createdAt: { gte: today } },
    });
    if (todayLogs > 0) return;

    const todayMsgCount = await this.prisma.message.count({
      where: { senderId: userId, createdAt: { gte: today } },
    });
    if (todayMsgCount < 5) return;

    const creditScore = await this.prisma.creditScore.findUnique({
      where: { userId },
    });
    if (!creditScore) return;

    await this.prisma.$transaction([
      this.prisma.creditScore.update({
        where: { userId },
        data: { score: { increment: 5 } },
      }),
      this.prisma.creditLog.create({
        data: {
          userId,
          actionType: 'CHAT_ACTIVE',
          scoreChange: 5,
          reason: '今日聊天活跃奖励',
        },
      }),
    ]);
  }

  private async getPlayStatsFromCache(key: string) {
    return (await this.redis.getJson<Record<string, PlayModeStat>>(key)) || {};
  }

  private async bumpPlayStats(
    key: string,
    modeKey: string,
    addOpen: boolean,
    addRun: boolean,
    addSuccess: boolean,
    addFail: boolean,
  ) {
    const stats = await this.getPlayStatsFromCache(key);
    const current = this.normalizePlayModeStat(stats[modeKey]);
    stats[modeKey] = {
      opens: current.opens + (addOpen ? 1 : 0),
      runs: current.runs + (addRun ? 1 : 0),
      success: current.success + (addSuccess ? 1 : 0),
      fail: current.fail + (addFail ? 1 : 0),
      lastRunAt:
        addOpen || addRun || addSuccess || addFail
          ? new Date().toISOString()
          : current.lastRunAt,
    };
    await this.redis.setJson(key, stats, 30 * 24 * 3600);
  }

  private buildReason(
    mode: PlayModeProfile,
    userStat: PlayModeStat,
    globalStat: PlayModeStat,
    boost: number,
  ) {
    if (this.getModeStageFit(mode) === 'GETTING_TO_KNOW') {
      return '当前处于初识阶段，建议优先选择低压力破冰玩法';
    }
    if (this.getModeStageFit(mode) === 'WARMING_UP') {
      return '当前适合升温互动，建议多使用共创或任务型玩法';
    }
    if (userStat.runs > 0 && userStat.success / Math.max(1, userStat.runs) > 0.5) {
      return '你最近对该玩法反馈较好，继续使用更容易进入状态';
    }
    if (boost >= 0.6) {
      return '结合你近期聊天行为，系统判断该玩法更容易提升互动质量';
    }
    if ((globalStat.runs || 0) >= 5) {
      return '近期热门玩法，适合快速升温';
    }
    if (mode.tags.includes('ai')) {
      return 'AI 辅助玩法，适合降低开聊压力';
    }
    return '适配当前关系阶段，建议尝试';
  }

  private async computeProfileBoost(
    userId: string,
    conversationId?: string,
    stage?: RelationshipStage,
  ) {
    const boost: Record<string, number> = {};
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const whereBase = conversationId ? { conversationId } : {};
    const total = await this.prisma.message.count({
      where: {
        ...whereBase,
        OR: [{ senderId: userId }, { conversation: { match: { OR: [{ userAId: userId }, { userBId: userId }] } } }],
        createdAt: { gte: since },
      },
    });
    const mine = await this.prisma.message.count({
      where: { ...whereBase, senderId: userId, createdAt: { gte: since } },
    });
    const media = await this.prisma.message.count({
      where: {
        ...whereBase,
        senderId: userId,
        type: { in: ['IMAGE', 'VIDEO', 'FILE', 'VOICE'] as any },
        createdAt: { gte: since },
      },
    });

    if (total < 12) {
      boost['awkward-rescue'] = 0.9;
      boost['resonance-room'] = 0.8;
    }
    if (media >= 3) {
      boost['voice-caption'] = 0.9;
      boost['real-challenge'] = 0.65;
    }
    if (mine >= 15) {
      boost['growth-tree'] = 0.85;
      boost['weekly-check'] = 0.78;
      boost['co-create'] = 0.72;
    }
    if (mine > 0 && total > 0 && mine / total < 0.35) {
      boost['ai-avatar'] = 0.8;
      boost['date-planner'] = 0.7;
    }
    if (stage === 'GETTING_TO_KNOW') {
      boost['ai-avatar'] = Math.max(boost['ai-avatar'] || 0, 0.92);
      boost['awkward-rescue'] = Math.max(boost['awkward-rescue'] || 0, 0.9);
      boost['resonance-room'] = Math.max(boost['resonance-room'] || 0, 0.85);
    } else if (stage === 'WARMING_UP') {
      boost['co-create'] = Math.max(boost['co-create'] || 0, 0.86);
      boost['date-planner'] = Math.max(boost['date-planner'] || 0, 0.82);
      boost['real-challenge'] = Math.max(boost['real-challenge'] || 0, 0.76);
    } else if (stage === 'STABLE') {
      boost['growth-tree'] = Math.max(boost['growth-tree'] || 0, 0.9);
      boost['weekly-check'] = Math.max(boost['weekly-check'] || 0, 0.88);
      boost['privacy-layers'] = Math.max(boost['privacy-layers'] || 0, 0.72);
    }
    return boost;
  }

  private normalizePlayModeStat(raw?: Partial<PlayModeStat> | null): PlayModeStat {
    const runs = Number(raw?.runs || 0);
    const opens = Number(raw?.opens ?? runs);
    return {
      opens: Number.isFinite(opens) ? opens : 0,
      runs: Number.isFinite(runs) ? runs : 0,
      success: Number.isFinite(Number(raw?.success || 0)) ? Number(raw?.success || 0) : 0,
      fail: Number.isFinite(Number(raw?.fail || 0)) ? Number(raw?.fail || 0) : 0,
      lastRunAt: raw?.lastRunAt || null,
    };
  }

  private getModeStageFit(mode: PlayModeProfile): RelationshipStage {
    if (mode.key === 'ai-avatar' || mode.key === 'awkward-rescue' || mode.key === 'resonance-room') {
      return 'GETTING_TO_KNOW';
    }
    if (mode.key === 'co-create' || mode.key === 'date-planner' || mode.key === 'real-challenge') {
      return 'WARMING_UP';
    }
    return 'STABLE';
  }

  private buildFunnelMeta(
    globalStats: Record<string, PlayModeStat>,
    userStats: Record<string, PlayModeStat>,
  ) {
    const sum = (source: Record<string, PlayModeStat>) => {
      return Object.values(source)
        .map((item) => this.normalizePlayModeStat(item))
        .reduce(
          (acc, cur) => {
            acc.opens += cur.opens;
            acc.runs += cur.runs;
            acc.success += cur.success;
            return acc;
          },
          { opens: 0, runs: 0, success: 0 },
        );
    };
    const global = sum(globalStats);
    const user = sum(userStats);
    const toPct = (num: number, base: number) =>
      base > 0 ? Number(((num / base) * 100).toFixed(1)) : 0;
    return {
      global: {
        ...global,
        clickRate: toPct(global.runs, global.opens),
        successRate: toPct(global.success, global.runs),
      },
      user: {
        ...user,
        clickRate: toPct(user.runs, user.opens),
        successRate: toPct(user.success, user.runs),
      },
    };
  }

  private async detectRelationshipStage(
    userId: string,
    conversationId?: string,
  ): Promise<RelationshipStage> {
    if (!conversationId) return 'GETTING_TO_KNOW';
    const convo = await this.assertConversationMember(conversationId, userId);
    const firstMessage = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (!firstMessage) return 'GETTING_TO_KNOW';
    const total = await this.prisma.message.count({ where: { conversationId } });
    const mine = await this.prisma.message.count({
      where: { conversationId, senderId: userId },
    });
    const partnerId = convo.match.userAId === userId ? convo.match.userBId : convo.match.userAId;
    const partner = await this.prisma.message.count({
      where: { conversationId, senderId: partnerId },
    });
    const reciprocal = Math.min(mine, partner) / Math.max(1, Math.max(mine, partner));
    const days = Math.max(
      1,
      Math.ceil((Date.now() - new Date(firstMessage.createdAt).getTime()) / (24 * 3600 * 1000)),
    );

    if (total >= 120 && reciprocal >= 0.55 && days >= 14) return 'STABLE';
    if (total >= 30 && reciprocal >= 0.4 && days >= 3) return 'WARMING_UP';
    return 'GETTING_TO_KNOW';
  }
}
