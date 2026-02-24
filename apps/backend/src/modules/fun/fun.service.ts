import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const PK_QUESTIONS = [
  { q: '雨天你更想？', a: '窝在家', b: '出去走走' },
  { q: '约会时间？', a: '白天', b: '深夜' },
  { q: '争吵后？', a: '先冷静', b: '马上解决' },
  { q: '更吸引你的？', a: '神秘感', b: '安全感' },
  { q: '旅行方式？', a: '随心走', b: '做攻略' },
  { q: '表达爱意？', a: '行动', b: '语言' },
  { q: '你更在意？', a: '内在契合', b: '外在吸引' },
  { q: '周末理想？', a: '两人世界', b: '社交派对' },
  { q: '遇到困难？', a: '独自消化', b: '找人倾诉' },
  { q: '关系节奏？', a: '慢慢来', b: '全力冲' },
];

const LUCKY_COLORS = [
  { name: '薰衣草紫', hex: '#A78BFA' },
  { name: '极光蓝', hex: '#38BDF8' },
  { name: '珊瑚粉', hex: '#F472B6' },
  { name: '星空靛', hex: '#6366F1' },
  { name: '日落橘', hex: '#FB923C' },
  { name: '薄荷绿', hex: '#34D399' },
  { name: '樱花粉', hex: '#FDA4AF' },
  { name: '午夜金', hex: '#FBBF24' },
];

const TASKS = [
  '给一个许久没联系的朋友发一条消息',
  '在镜子前对自己微笑 10 秒',
  '写下三件今天感恩的小事',
  '去和一个陌生人微笑点头',
  '给你最近的聊天对象送一个表情包',
  '在心里默默夸自己三个优点',
  '对着天空深呼吸 5 次',
  '给手机壁纸换一张治愈系图片',
  '在社交平台发一条正能量动态',
  '找一首没听过的歌完整听完',
];

const SUMMARIES = [
  '今天你的能量场特别吸引温柔的灵魂',
  '星相显示你今天适合主动出击',
  '宇宙暗示你放下防备，打开心扉',
  '你的磁场今天格外强大，准备好被惊喜击中',
  '今天是重新定义关系的好日子',
  '某个深夜对话可能会改变一些事',
  '你的直觉今天特别准，相信自己的感觉',
];

const SOUL_TYPES = [
  {
    type: '✦ 深海潜行者',
    desc: '你有一颗深邃的灵魂，善于在沉默中找到力量。',
    trait: '内省·深邃·敏感',
    color: '#3B82F6',
  },
  {
    type: '✦ 星火流浪者',
    desc: '你是一个自由的灵魂，不喜欢被定义。',
    trait: '自由·好奇·热情',
    color: '#F43F5E',
  },
  {
    type: '✦ 月光治愈师',
    desc: '你温柔且有力量，总能给身边人温暖。',
    trait: '温暖·共情·治愈',
    color: '#8B5CF6',
  },
  {
    type: '✦ 量子共振体',
    desc: '你的思维跳跃而独特，对深度链接有渴望。',
    trait: '独特·跳跃·渴望',
    color: '#06B6D4',
  },
];

@Injectable()
export class FunService {
  constructor(private prisma: PrismaService) {}

  private dateSeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  private seededRandom(seed: number, index: number): number {
    let h = seed + index * 9301 + 49297;
    h = (h * 9301 + 49297) % 233280;
    return h / 233280;
  }

  async openBlindbox(userId: string) {
    const accepted = await this.prisma.match.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            city: true,
            bio: true,
            gender: true,
            birthDate: true,
          },
        },
        userB: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            city: true,
            bio: true,
            gender: true,
            birthDate: true,
          },
        },
      },
    });
    if (accepted.length === 0) {
      throw new NotFoundException('今天的盲盒已空，明天再来');
    }
    const seed =
      this.dateSeed() +
      userId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const picked =
      accepted[Math.floor(this.seededRandom(seed, 9) * accepted.length)];
    const other = picked.userA.id === userId ? picked.userB : picked.userA;
    return {
      userId: other.id,
      nickname: other.nickname,
      avatar: other.avatar,
      score: Math.round(picked.score),
      matchReason: picked.matchReason || '缘分天注定',
      bio: other.bio,
      city: other.city,
      gender: other.gender,
      age: other.birthDate
        ? Math.floor((Date.now() - other.birthDate.getTime()) / 31557600000)
        : null,
      matchId: picked.id,
    };
  }

  async startCompatPk(userId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw new NotFoundException('匹配不存在');
    if (match.userAId !== userId && match.userBId !== userId)
      throw new ForbiddenException('无权操作该匹配');
    const seed = matchId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const questions = [...PK_QUESTIONS]
      .sort(() => 0.5 - this.seededRandom(seed, 1))
      .slice(0, 5);
    const opponentAnswers = questions.map((q, i) => {
      const hash = (seed * 31 + i * 17 + q.q.length) % 100;
      return hash >= 50 ? 'a' : 'b';
    });
    return { questions, opponentAnswers };
  }

  async calcCompatPk(userId: string, matchId: string, myAnswers: string[]) {
    const { opponentAnswers } = await this.startCompatPk(userId, matchId);
    const score = Math.round(
      (myAnswers.filter((a, i) => a === opponentAnswers[i]).length / 5) * 100,
    );
    return { score, opponentAnswers };
  }

  getTodayFortune(userId: string) {
    const userSeed = userId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const seed = this.dateSeed() + userSeed;
    return {
      loveLuck: Math.floor(this.seededRandom(seed, 0) * 3) + 3,
      socialLuck: Math.floor(this.seededRandom(seed, 1) * 3) + 3,
      moodIndex: Math.floor(this.seededRandom(seed, 2) * 3) + 3,
      luckyColor:
        LUCKY_COLORS[
          Math.floor(this.seededRandom(seed, 3) * LUCKY_COLORS.length)
        ],
      dailyTask: TASKS[Math.floor(this.seededRandom(seed, 4) * TASKS.length)],
      summary:
        SUMMARIES[Math.floor(this.seededRandom(seed, 5) * SUMMARIES.length)],
    };
  }

  evaluateSoulQa(scoreVectors: number[][]) {
    const totals = [0, 0, 0, 0];
    scoreVectors.forEach((v) =>
      v.forEach((n, i) => {
        totals[i] += Number(n) || 0;
      }),
    );
    const idx = totals.indexOf(Math.max(...totals));
    return SOUL_TYPES[idx] || SOUL_TYPES[0];
  }
}
