import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat';

const TOPIC_PROMPTS: Record<string, string> = {
  dao: '你是一位深谙天道哲理的智者，用通俗易懂的方式引导用户理解宇宙规律、因果法则和人生大道。结合中国传统哲学（道家、儒家、佛家）与现代心理学，帮助用户从更高维度看待困惑。',
  emotion:
    '你是一位温暖的心理咨询师，擅长情感疏导。用共情和倾听的方式，帮助用户处理情感问题，提供实用的情感建议。',
  anxiety:
    '你是一位焦虑管理专家，帮助用户识别焦虑根源，提供呼吸练习、正念冥想等实用技巧，引导用户走出焦虑困境。',
  growth:
    '你是一位人生成长导师，帮助用户探索自我、设定目标、突破瓶颈，从哲学和心理学角度引导个人成长。',
  sleep:
    '你是一位睡眠与放松专家，用温柔舒缓的语气帮助用户放松身心，提供助眠方法和内心宁静的指导。',
  general:
    '你是一位融合东方智慧与现代心理学的心灵导师，用温暖、智慧的方式帮助用户获得内心平静和人生方向。',
};

const TOPIC_LABELS: Record<string, string> = {
  dao: '天道感悟',
  emotion: '情感疏导',
  anxiety: '焦虑化解',
  growth: '自我成长',
  sleep: '静心助眠',
  general: '心灵对话',
};

@Injectable()
export class SoulService {
  private readonly logger = new Logger(SoulService.name);

  constructor(private prisma: PrismaService) {}

  async createSession(userId: string, topic: string, firstMessage: string) {
    const label = TOPIC_LABELS[topic] || TOPIC_LABELS.general;
    const session = await this.prisma.soulSession.create({
      data: {
        userId,
        topic,
        title: label,
        status: 'AI',
      },
    });

    await this.prisma.soulMessage.create({
      data: { sessionId: session.id, role: 'user', content: firstMessage },
    });

    const aiReply = await this.generateAIReply(topic, [
      { role: 'user', content: firstMessage },
    ]);
    await this.prisma.soulMessage.create({
      data: { sessionId: session.id, role: 'ai', content: aiReply },
    });

    return this.getSession(session.id, userId);
  }

  async getMySessions(userId: string) {
    return this.prisma.soulSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
    });
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.soulSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session || session.userId !== userId)
      throw new NotFoundException('Session not found');
    return session;
  }

  async sendMessage(sessionId: string, userId: string, content: string) {
    const session = await this.prisma.soulSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId)
      throw new NotFoundException('Session not found');
    if (session.status === 'CLOSED')
      throw new ForbiddenException('Session closed');

    await this.prisma.soulMessage.create({
      data: { sessionId, role: 'user', content },
    });

    await this.prisma.soulSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    if (session.status === 'AI') {
      const history = await this.prisma.soulMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      const aiReply = await this.generateAIReply(
        session.topic,
        history.map((m) => ({ role: m.role, content: m.content })),
      );
      await this.prisma.soulMessage.create({
        data: { sessionId, role: 'ai', content: aiReply },
      });
    }

    return this.getSession(sessionId, userId);
  }

  async closeSession(sessionId: string, userId: string) {
    const session = await this.prisma.soulSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId)
      throw new NotFoundException('Session not found');
    return this.prisma.soulSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED' },
    });
  }

  // ── Admin methods ──

  async adminGetSessions(page = 1, pageSize = 20, status?: string) {
    const where: any = {};
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.soulSession.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.soulSession.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async adminGetSession(sessionId: string) {
    return this.prisma.soulSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async adminTakeover(sessionId: string, adminId: string) {
    return this.prisma.soulSession.update({
      where: { id: sessionId },
      data: { status: 'HUMAN', adminId },
    });
  }

  async adminReply(sessionId: string, adminId: string, content: string) {
    const session = await this.prisma.soulSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'CLOSED')
      throw new ForbiddenException('Session closed');
    if (session.status !== 'HUMAN')
      throw new ForbiddenException('Session not taken over');
    if (session.adminId !== adminId)
      throw new ForbiddenException('Only owner admin can reply');

    await this.prisma.soulMessage.create({
      data: { sessionId, role: 'admin', content },
    });

    await this.prisma.soulSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return this.adminGetSession(sessionId);
  }

  async adminReleaseToAI(sessionId: string) {
    return this.prisma.soulSession.update({
      where: { id: sessionId },
      data: { status: 'AI', adminId: null },
    });
  }

  async adminCloseSession(sessionId: string) {
    return this.prisma.soulSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED' },
    });
  }

  // ── AI generation ──

  private async generateAIReply(
    topic: string,
    history: { role: string; content: string }[],
  ): Promise<string> {
    const systemPrompt = TOPIC_PROMPTS[topic] || TOPIC_PROMPTS.general;

    if (DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'sk-xxxxx') {
      try {
        return await this.callDeepSeek(systemPrompt, history);
      } catch (e) {
        this.logger.warn(`DeepSeek API failed: ${e}, falling back to local`);
      }
    }

    return this.getLocalReply(topic, history);
  }

  private async callDeepSeek(
    systemPrompt: string,
    history: { role: string; content: string }[],
  ): Promise<string> {
    const messages = [
      {
        role: 'system',
        content:
          systemPrompt +
          '\n\n请用温暖、有深度的方式回复。每次回复控制在200字以内。可以适当使用emoji。',
      },
      ...history.slice(-10).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ];

    const resp = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!resp.ok) throw new Error(`DeepSeek returned ${resp.status}`);
    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) throw new Error('Empty response from DeepSeek');
    return reply;
  }

  private getLocalReply(
    topic: string,
    history: { role: string; content: string }[],
  ): string {
    const lastMsg = history[history.length - 1]?.content || '';
    const isLong = lastMsg.length > 20;
    const msgCount = history.filter((h) => h.role === 'user').length;

    const wisdomResponses: Record<string, string[]> = {
      dao: [
        `🌿 你提到的这个问题，让我想到老子说的"道可道，非常道"。\n\n${isLong ? '你的困惑说明你在思考更深层的东西。' : '每一个疑问都是觉醒的开始。'}\n\n天道运行有规律——春生夏长、秋收冬藏。你现在经历的，可能正是人生的"冬藏"时期。\n\n💡 不是生活在为难你，而是宇宙在帮你沉淀。`,
        `☯️ 《道德经》说："反者道之动。"万物皆有阴阳两面，困境的背面往往藏着机遇。\n\n${msgCount > 2 ? '我注意到你一直在深入思考，这很好。' : '很高兴你愿意探索这个话题。'}\n\n🧘 建议今天找一个安静时刻，闭眼深呼吸三次。答案往往在安静中浮现。`,
        `🌊 天道核心之一是"顺势而为"——像水一样，遇阻则绕行，永远朝大海流去。\n\n允许自己不确定、允许迷茫，本身就是一种智慧。古人说"不争而善胜"，放下执念反而能看到更广阔天地。\n\n你最近有什么特别放不下的事吗？`,
      ],
      emotion: [
        `💙 我听到你了。你的感受完全合理，不需要自责。\n\n${isLong ? '你说了这么多，我能感受到你内心的重量。' : '情绪就像天气，有晴有雨都正常。'}\n\n能和我分享这些，说明你很勇敢。你愿意多说一些吗？\n\n🌸 允许自己难过不代表软弱，恰恰说明你在认真对待内心。`,
        `🤗 谢谢你信任我。\n\n在情感中，我们最容易犯的错是用理性压制感性。你现在最真实的感受是什么？\n\n${msgCount > 2 ? '我一直在认真听你说的每一句话。' : ''}\n\n试试对自己说："我的感受是真实的，我值得被温柔对待。"`,
      ],
      anxiety: [
        `🍃 焦虑来了？没关系，我们一起面对。\n\n焦虑是大脑的保护机制，说明你在乎。但过度焦虑像手机后台开了太多程序。\n\n现在跟我做4-7-8呼吸：\n• 吸气4秒 • 屏住7秒 • 呼出8秒\n\n重复3次。\n\n🌿 焦虑最怕"此时此刻"——专注当下时，焦虑就失去了力量。`,
        `🌈 ${isLong ? '我理解你描述的那种感觉。' : '我理解那种焦虑感——像心里装了一台不停转的洗衣机。'}\n\n来做个练习：说出5个你现在能看到的东西。\n\n这叫"着陆技术"，帮你从焦虑漩涡回到此刻。你最近最焦虑的具体事情是什么？我们可以一起拆解。`,
      ],
      growth: [
        `✨ 每个想成长的人，都已走在正确的路上。\n\n${msgCount > 2 ? '我发现你在不断深入探索自己，这种态度很珍贵。' : '你现在思考的问题，很多人一辈子不会去想。'}\n\n成长不是直线，更像螺旋楼梯——看似绕圈，其实每圈都上升一层。\n\n🎯 如果一年后的你回头看现在，最希望自己做了什么？`,
      ],
      sleep: [
        `🌙 夜深了，一起慢下来。\n\n想象宁静湖边，月光洒在水面，微风轻拂。每次呼吸都在告诉身体：安全了，可以休息了。\n\n放下今天所有的事——它们明天还在，但此刻不需要你。\n\n🌊 让思绪像云一样飘过，不需要抓住任何一朵。你是安全的，你值得好觉。`,
      ],
      general: [
        `🌟 ${msgCount <= 1 ? '欢迎来到心灵空间。' : '我在这里。'}\n\n${isLong ? '感谢你分享这么多。' : '不管你带着什么来到这里——困惑、疲惫、或只是想聊聊——都来对地方了。'}\n\n这里没有标准答案，只有属于你的探索。${msgCount <= 1 ? '你想从哪里开始？' : '继续说吧，我在听。'}`,
        `💫 ${msgCount > 3 ? '我们聊了一些了，你有没有感觉好一些？' : '你好。'}\n\n有时需要的不是建议，而是安静的空间和愿意倾听的存在。\n\n我就在这里。现在你心里最想说的一句话是什么？`,
      ],
    };

    const pool = wisdomResponses[topic] || wisdomResponses.general;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
