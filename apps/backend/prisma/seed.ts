import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const users = [
  {
    email: 'alice@test.com',
    phone: '13800000001',
    nickname: 'Alice',
    gender: 'FEMALE' as const,
    avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop&crop=face',
    bio: '热爱旅行和摄影，喜欢探索世界的每个角落 📸',
    city: '上海',
    province: '上海',
    birthDate: new Date('1996-03-15'),
    profile: {
      attachmentType: 'SECURE' as const,
      communicationStyle: 'DIRECT' as const,
      personalityTags: JSON.stringify(['开朗', '独立', '有创意', '爱旅行']),
      aiSummary: '安全型依恋，沟通直接，性格独立开朗，对新事物充满好奇心。',
      testCompleted: true,
    },
  },
  {
    email: 'bob@test.com',
    phone: '13800000002',
    nickname: 'Bob',
    gender: 'MALE' as const,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop&crop=face',
    bio: '程序员 / 读书爱好者 / 周末徒步 🏔️',
    city: '上海',
    province: '上海',
    birthDate: new Date('1994-08-22'),
    profile: {
      attachmentType: 'SECURE' as const,
      communicationStyle: 'ANALYTICAL' as const,
      personalityTags: JSON.stringify(['理性', '温和', '爱阅读', '户外运动']),
      aiSummary: '安全型依恋，分析型沟通风格，性格温和理性，兴趣广泛。',
      testCompleted: true,
    },
  },
  {
    email: 'clara@test.com',
    phone: '13800000003',
    nickname: '小清',
    gender: 'FEMALE' as const,
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop&crop=face',
    bio: '插画师，喜欢猫和咖啡 ☕🐱',
    city: '杭州',
    province: '浙江',
    birthDate: new Date('1998-01-10'),
    profile: {
      attachmentType: 'ANXIOUS' as const,
      communicationStyle: 'EMOTIONAL' as const,
      personalityTags: JSON.stringify(['感性', '细腻', '艺术', '猫奴']),
      aiSummary: '焦虑型依恋，情感丰富，具有较强的艺术天赋和共情能力。',
      testCompleted: true,
    },
  },
  {
    email: 'david@test.com',
    phone: '13800000004',
    nickname: 'David',
    gender: 'MALE' as const,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&crop=face',
    bio: '产品经理，业余健身，偶尔弹吉他 🎸',
    city: '北京',
    province: '北京',
    birthDate: new Date('1995-06-05'),
    profile: {
      attachmentType: 'AVOIDANT' as const,
      communicationStyle: 'INDIRECT' as const,
      personalityTags: JSON.stringify(['内敛', '有主见', '音乐', '健身']),
      aiSummary: '回避型依恋，间接沟通风格，有较强的独立性和个人空间需求。',
      testCompleted: true,
    },
  },
  {
    email: 'emma@test.com',
    phone: '13800000005',
    nickname: '小鱼',
    gender: 'FEMALE' as const,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&crop=face',
    bio: '美食博主 / 烘焙达人 / 热爱生活 🍰',
    city: '成都',
    province: '四川',
    birthDate: new Date('1997-11-28'),
    profile: {
      attachmentType: 'SECURE' as const,
      communicationStyle: 'DIRECT' as const,
      personalityTags: JSON.stringify(['开朗', '热情', '美食', '社交达人']),
      aiSummary: '安全型依恋，直接沟通，性格热情外向，善于社交。',
      testCompleted: true,
    },
  },
  {
    email: 'frank@test.com',
    phone: '13800000006',
    nickname: '阿峰',
    gender: 'MALE' as const,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=800&fit=crop&crop=face',
    bio: '建筑师，喜欢设计和骑行 🚴',
    city: '深圳',
    province: '广东',
    birthDate: new Date('1993-04-18'),
    profile: {
      attachmentType: 'SECURE' as const,
      communicationStyle: 'ANALYTICAL' as const,
      personalityTags: JSON.stringify(['严谨', '有审美', '运动', '爱旅行']),
      aiSummary: '安全型依恋，分析型沟通，审美能力强，做事严谨有条理。',
      testCompleted: true,
    },
  },
  {
    email: 'grace@test.com',
    phone: '13800000007',
    nickname: 'Grace',
    gender: 'FEMALE' as const,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=800&fit=crop&crop=face',
    bio: '心理学研究生，瑜伽爱好者 🧘‍♀️',
    city: '北京',
    province: '北京',
    birthDate: new Date('1997-07-03'),
    profile: {
      attachmentType: 'SECURE' as const,
      communicationStyle: 'EMOTIONAL' as const,
      personalityTags: JSON.stringify(['共情', '温暖', '知性', '瑜伽']),
      aiSummary: '安全型依恋，情感表达能力强，善于倾听和理解他人。',
      testCompleted: true,
    },
  },
  {
    email: 'henry@test.com',
    phone: '13800000008',
    nickname: '小亨',
    gender: 'MALE' as const,
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&h=800&fit=crop&crop=face',
    bio: '金融分析师 / 马拉松跑者 / 咖啡控 ☕',
    city: '上海',
    province: '上海',
    birthDate: new Date('1994-12-01'),
    profile: {
      attachmentType: 'ANXIOUS' as const,
      communicationStyle: 'DIRECT' as const,
      personalityTags: JSON.stringify(['上进', '自律', '运动', '社交']),
      aiSummary: '焦虑型依恋，沟通直接，自律性强，有较高的成就动机。',
      testCompleted: true,
    },
  },
];

const DYNAMIC_TOTAL = 1000;

const IMAGE_POOL = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=900&fit=crop',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&h=900&fit=crop',
  'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1200&h=900&fit=crop',
  'https://images.unsplash.com/photo-1493244040629-496f6d136cc3?w=1200&h=900&fit=crop',
  'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=1200&h=900&fit=crop',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=900&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=900&fit=crop',
  'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=1200&h=900&fit=crop',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&h=900&fit=crop',
  'https://images.unsplash.com/photo-1521292270410-a8c4d716d518?w=1200&h=900&fit=crop',
];

const VIDEO_POOL = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
];

const MUSIC_POOL = [
  'City Lights - LoFi Mix',
  '夜色频率 · Ambient',
  'Wave Signal - Chillhop',
  '反重力晚风 - Indie',
  'Blue Echoes - Jazzhop',
  '晨间电台 - Acoustic',
];

const LOCATION_POOL = ['上海', '北京', '杭州', '深圳', '成都', '广州', '南京', '苏州'];
const LINK_POOL = [
  'https://www.bilibili.com',
  'https://music.163.com',
  'https://www.xiaohongshu.com',
  'https://www.douban.com',
  'https://sspai.com',
];

const PULSE_TEXT_POOL = [
  '今天把计划推进了一大步，状态比预期更稳。',
  '刚结束一场很有质量的对话，感觉被理解了。',
  '夜跑回来，脑子很清醒，记录一下当下的能量。',
  '做了一顿简单晚餐，幸福感意外地高。',
  '读到一句话：慢一点，反而会更快。',
  '周末想找人一起探店，偏安静一点的地方。',
  '今天的工作节奏偏满，但完成感很足。',
  '下雨天适合听歌，也适合把情绪慢慢放下。',
  '尝试了新的学习方法，效率提升明显。',
  '如果你也在调整生活节奏，欢迎交流经验。',
];

const COMMENT_POOL = [
  '这个状态很真实，赞同。',
  '同感，我最近也是这样。',
  '表达得很有画面感。',
  '有被这句击中，收藏了。',
  '这个角度很有意思。',
  '看完想去尝试一下。',
  '节奏感很好，继续保持。',
  '感谢分享，收获到了。',
];

const POLL_POOL = [
  ['周末更想', '宅家充电', '户外走走', '约朋友聊天'],
  ['你更看重', '情绪稳定', '价值观一致', '沟通效率'],
  ['夜晚放松方式', '听歌', '散步', '刷书/课程', '看电影'],
  ['约会偏好', '咖啡店', '展览馆', '公园散步', '一起做饭'],
  ['最近想提升', '专注力', '表达力', '运动习惯', '作息规律'],
];

const MOODS = ['happy', 'calm', 'excited', 'love', 'think', null];

type SeedUser = { id: string; nickname: string };
type CreatedDynamic = {
  id: string;
  userId: string;
  createdAt: Date;
  pollOptionIds: string[];
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(p: number) {
  return Math.random() < p;
}

function pickOne<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function main() {
  console.log('Seeding database...\n');

  // Clear non-admin user related data only, keep admin accounts untouched.
  const normalUsers = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true },
  });
  const normalUserIds = normalUsers.map((u) => u.id);

  if (normalUserIds.length > 0) {
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { userAId: { in: normalUserIds } },
          { userBId: { in: normalUserIds } },
        ],
      },
      select: { id: true },
    });
    const matchIds = matches.map((m) => m.id);

    if (matchIds.length > 0) {
      const convs = await prisma.conversation.findMany({
        where: { matchId: { in: matchIds } },
        select: { id: true },
      });
      const convIds = convs.map((c) => c.id);
      if (convIds.length > 0) {
        await prisma.message.deleteMany({
          where: { conversationId: { in: convIds } },
        });
      }
      await prisma.relationship.deleteMany({
        where: { matchId: { in: matchIds } },
      });
      await prisma.conversation.deleteMany({
        where: { matchId: { in: matchIds } },
      });
      await prisma.match.deleteMany({
        where: { id: { in: matchIds } },
      });
    }

    await prisma.soulMessage.deleteMany({
      where: { session: { userId: { in: normalUserIds } } },
    });
    await prisma.soulSession.deleteMany({
      where: { userId: { in: normalUserIds } },
    });

    await prisma.dynamicPollVote.deleteMany({
      where: {
        OR: [
          { userId: { in: normalUserIds } },
          { dynamic: { userId: { in: normalUserIds } } },
        ],
      },
    });
    await prisma.dynamicLike.deleteMany({
      where: {
        OR: [
          { userId: { in: normalUserIds } },
          { dynamic: { userId: { in: normalUserIds } } },
        ],
      },
    });
    await prisma.dynamicComment.deleteMany({
      where: {
        OR: [
          { userId: { in: normalUserIds } },
          { dynamic: { userId: { in: normalUserIds } } },
        ],
      },
    });
    await prisma.dynamicPollOption.deleteMany({
      where: { dynamic: { userId: { in: normalUserIds } } },
    });
    await prisma.dynamic.deleteMany({
      where: { userId: { in: normalUserIds } },
    });

    await prisma.report.deleteMany({
      where: {
        OR: [
          { reporterId: { in: normalUserIds } },
          { reportedId: { in: normalUserIds } },
        ],
      },
    });
    await prisma.userBlock.deleteMany({
      where: {
        OR: [
          { blockerId: { in: normalUserIds } },
          { blockedId: { in: normalUserIds } },
        ],
      },
    });
    await prisma.creditLog.deleteMany({
      where: { userId: { in: normalUserIds } },
    });
    await prisma.creditScore.deleteMany({
      where: { userId: { in: normalUserIds } },
    });
    await prisma.userProfile.deleteMany({
      where: { userId: { in: normalUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: normalUserIds } },
    });
  }

  const hashedPassword = await hash('123456', 12);

  // Keep existing admin account if present; create one only when missing.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@linksoul.com' },
    update: {},
    create: {
      email: 'admin@linksoul.com',
      phone: '13800000000',
      nickname: '管理员',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      profile: { create: { testCompleted: false } },
      creditScore: { create: { score: 0, level: 'BRONZE' } },
    },
  });
  console.log(`  Kept admin: ${admin.nickname} (${admin.email})`);

  const createdUsers: SeedUser[] = [];

  for (const u of users) {
    const { profile, ...userData } = u;
    const user = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        status: 'ACTIVE',
        profile: { create: profile },
        creditScore: { create: { score: 0, level: 'BRONZE' } },
      },
    });
    createdUsers.push(user);
    console.log(`  Created user: ${user.nickname} (${user.email})`);
  }

  // Create matches
  const matchPairs = [
    { a: 0, b: 1, score: 85, reason: '同城上海，依恋风格互补，共同爱好户外活动', status: 'ACCEPTED' as const },
    { a: 0, b: 3, score: 72, reason: '性格互补，Alice的开朗与David的内敛形成平衡', status: 'ACCEPTED' as const },
    { a: 1, b: 2, score: 78, reason: 'Bob的理性温和与小清的感性细腻相互吸引', status: 'PENDING' as const },
    { a: 2, b: 5, score: 80, reason: '共同的艺术审美，创意领域互相欣赏', status: 'PENDING' as const },
    { a: 4, b: 7, score: 88, reason: '性格都外向热情，共同爱好社交和运动', status: 'ACCEPTED' as const },
    { a: 6, b: 7, score: 75, reason: '北京同城，Grace的心理学背景与小亨的沟通需求匹配', status: 'PENDING' as const },
    { a: 4, b: 5, score: 70, reason: '小鱼的热情与阿峰的严谨形成互补', status: 'ACCEPTED' as const },
    { a: 0, b: 6, score: 82, reason: '都是安全型依恋，直接沟通风格，兴趣契合度高', status: 'PENDING' as const },
  ];

  const createdMatches: any[] = [];
  for (const mp of matchPairs) {
    const match = await prisma.match.create({
      data: {
        userAId: createdUsers[mp.a].id,
        userBId: createdUsers[mp.b].id,
        score: mp.score,
        matchReason: mp.reason,
        status: mp.status,
      },
    });
    createdMatches.push(match);
    console.log(`  Match: ${users[mp.a].nickname} ↔ ${users[mp.b].nickname} (${mp.score}%, ${mp.status})`);
  }

  // Create conversations & messages for ACCEPTED matches
  const acceptedMatches = matchPairs
    .map((mp, i) => ({ ...mp, match: createdMatches[i] }))
    .filter((mp) => mp.status === 'ACCEPTED');

  const chatMessages: Record<number, { sender: 'a' | 'b'; text: string }[]> = {
    0: [
      { sender: 'a', text: '嗨 Bob！看到你也喜欢徒步，你一般去哪里？' },
      { sender: 'b', text: 'Hi Alice！我经常去浙西大峡谷和莫干山，你呢？' },
      { sender: 'a', text: '我上次去了武功山，超级美！下次可以组队 😄' },
      { sender: 'b', text: '武功山一直在我的清单上！什么时候出发？' },
      { sender: 'a', text: '三月底怎么样？天气应该刚好' },
      { sender: 'b', text: '三月底可以，我看看攻略，回头分享给你' },
    ],
    1: [
      { sender: 'a', text: 'David 你好，你的吉他弹了多久了？' },
      { sender: 'b', text: '大概三年了，不过都是自学的，水平一般 😅' },
      { sender: 'a', text: '自学三年已经很厉害了！我一直想学乐器来着' },
      { sender: 'b', text: '可以从尤克里里开始，比吉他好上手' },
    ],
    4: [
      { sender: 'a', text: '小亨！听说你跑马拉松？完赛过几次了？' },
      { sender: 'b', text: '跑过三次全马，最好成绩 3:45，你也跑步吗？' },
      { sender: 'a', text: '我跑过半马，全马还不敢挑战 哈哈' },
      { sender: 'b', text: '循序渐进就好，可以先从30K跑起' },
      { sender: 'a', text: '好的！对了你平时在哪里跑？' },
      { sender: 'b', text: '世纪公园和滨江大道，环境很好' },
      { sender: 'a', text: '滨江那边确实不错，改天约跑！' },
      { sender: 'b', text: '没问题，周末早上可以 🏃‍♂️' },
    ],
    6: [
      { sender: 'a', text: '阿峰你好！你们建筑师的审美果然不一样，你的照片好好看' },
      { sender: 'b', text: '谢谢！职业习惯吧，看什么都会关注线条和光影' },
      { sender: 'a', text: '我做烘焙也很看重颜值，美食也是一种艺术嘛' },
      { sender: 'b', text: '确实！形式美和味觉体验缺一不可' },
      { sender: 'a', text: '下次做了好看的蛋糕给你拍照鉴赏 📸' },
    ],
  };

  for (let i = 0; i < acceptedMatches.length; i++) {
    const am = acceptedMatches[i];
    const conv = await prisma.conversation.create({
      data: { matchId: am.match.id, type: 'DIRECT', status: 'ACTIVE' },
    });

    const msgs = chatMessages[i] || [];
    const baseTime = new Date('2026-02-20T10:00:00Z');
    for (let j = 0; j < msgs.length; j++) {
      const senderId = msgs[j].sender === 'a' ? createdUsers[am.a].id : createdUsers[am.b].id;
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId,
          content: msgs[j].text,
          type: 'TEXT',
          createdAt: new Date(baseTime.getTime() + j * 3600_000),
        },
      });
    }
    console.log(`  Conversation: ${users[am.a].nickname} ↔ ${users[am.b].nickname} (${msgs.length} messages)`);
  }

  // Create relationships for some accepted matches
  await prisma.relationship.create({
    data: {
      matchId: createdMatches[0].id,
      stage: 'GETTING_TO_KNOW',
      aiAssessment: '双方沟通顺畅，话题广泛，已建立初步的信任感。建议继续深入交流生活理念。',
      progressScore: 35,
    },
  });
  await prisma.relationship.create({
    data: {
      matchId: createdMatches[4].id,
      stage: 'GETTING_TO_KNOW',
      aiAssessment: '两人互动频繁，共同运动爱好是很好的连接点。目前关系发展积极。',
      progressScore: 42,
    },
  });

  // Credit logs
  for (const user of createdUsers) {
    await prisma.creditLog.create({
      data: { userId: user.id, actionType: 'COMPLETE_PROFILE', scoreChange: 10, reason: '完善个人资料' },
    });
    await prisma.creditLog.create({
      data: { userId: user.id, actionType: 'PERSONALITY_TEST', scoreChange: 15, reason: '完成性格测试' },
    });
    await prisma.creditScore.update({
      where: { userId: user.id },
      data: { score: { increment: 25 } },
    });
  }

  // Generate richer feed demo data
  const createdDynamics: CreatedDynamic[] = [];
  let pollDynamics = 0;
  for (let i = 0; i < DYNAMIC_TOTAL; i += 1) {
    const author = pickOne(createdUsers);
    const pollPack = chance(0.22) ? pickOne(POLL_POOL) : null;
    const pollOptions = pollPack
      ? shuffle(pollPack.slice(1)).slice(0, randInt(2, Math.min(4, pollPack.length - 1)))
      : [];
    const mediaList: Array<{ type: 'image' | 'video'; url: string }> = [];
    if (chance(0.58)) {
      const mediaCount = randInt(1, 4);
      for (let m = 0; m < mediaCount; m += 1) {
        const isVideo = chance(0.2);
        mediaList.push({
          type: isVideo ? 'video' : 'image',
          url: isVideo ? pickOne(VIDEO_POOL) : pickOne(IMAGE_POOL),
        });
      }
    }
    const firstImage = mediaList.find((m) => m.type === 'image')?.url || null;
    const createdAt = new Date(Date.now() - randInt(0, 45 * 24 * 3600 * 1000));
    const baseContent = pickOne(PULSE_TEXT_POOL);
    const tag = pickOne(['#日常', '#状态更新', '#同频交流', '#晚安频道', '#成长日志']);
    const content = pollPack
      ? `${baseContent}\n📊 ${pollPack[0]}？\n${tag}`
      : `${baseContent}\n${tag}`;

    const dynamic = await prisma.dynamic.create({
      data: {
        userId: author.id,
        type: chance(0.86)
          ? 'post'
          : pickOne(['checkin', 'test', 'match', 'system']),
        content,
        imageUrl: firstImage,
        mediaList: mediaList.length ? JSON.stringify(mediaList) : null,
        mood: pickOne(MOODS) as string | null,
        music: chance(0.33) ? pickOne(MUSIC_POOL) : null,
        location: chance(0.4) ? pickOne(LOCATION_POOL) : null,
        link: chance(0.15) ? pickOne(LINK_POOL) : null,
        visibility: chance(0.9) ? 'public' : chance(0.5) ? 'friends' : 'private',
        createdAt,
        pollOptions: pollOptions.length
          ? {
              create: pollOptions.map((text, idx) => ({
                text,
                sortOrder: idx,
              })),
            }
          : undefined,
      },
      include: { pollOptions: true },
    });

    if (dynamic.pollOptions.length > 0) {
      pollDynamics += 1;
    }
    createdDynamics.push({
      id: dynamic.id,
      userId: dynamic.userId,
      createdAt,
      pollOptionIds: dynamic.pollOptions.map((o) => o.id),
    });
  }

  let totalLikes = 0;
  let totalComments = 0;
  let totalPollVotes = 0;
  for (const dynamic of createdDynamics) {
    const others = createdUsers.filter((u) => u.id !== dynamic.userId);

    const likeCount = chance(0.7) ? randInt(0, Math.min(10, others.length)) : 0;
    const likeUsers = shuffle(others).slice(0, likeCount);
    if (likeUsers.length > 0) {
      await prisma.dynamicLike.createMany({
        data: likeUsers.map((u) => ({
          dynamicId: dynamic.id,
          userId: u.id,
        })),
      });
    }
    await prisma.dynamic.update({
      where: { id: dynamic.id },
      data: { likes: likeUsers.length },
    });
    totalLikes += likeUsers.length;

    const commentCount = chance(0.68) ? randInt(0, 5) : 0;
    if (commentCount > 0) {
      await prisma.dynamicComment.createMany({
        data: Array.from({ length: commentCount }).map((_, idx) => {
          const commenter = pickOne(others);
          return {
            dynamicId: dynamic.id,
            userId: commenter.id,
            content: pickOne(COMMENT_POOL),
            createdAt: new Date(dynamic.createdAt.getTime() + (idx + 1) * 3600 * 1000),
          };
        }),
      });
      totalComments += commentCount;
    }

    if (dynamic.pollOptionIds.length >= 2 && others.length > 0) {
      const voteUsers = shuffle(others).slice(0, randInt(1, Math.min(8, others.length)));
      const optionCountMap = new Map<string, number>();
      const voteRows = voteUsers.map((u) => {
        const optionId = pickOne(dynamic.pollOptionIds);
        optionCountMap.set(optionId, (optionCountMap.get(optionId) || 0) + 1);
        return {
          dynamicId: dynamic.id,
          optionId,
          userId: u.id,
        };
      });
      await prisma.dynamicPollVote.createMany({ data: voteRows });
      await Promise.all(
        Array.from(optionCountMap.entries()).map(([optionId, votes]) =>
          prisma.dynamicPollOption.update({
            where: { id: optionId },
            data: { votes },
          }),
        ),
      );
      totalPollVotes += voteRows.length;
    }
  }

  console.log('\nSeed completed!');
  console.log(`  ${createdUsers.length} users`);
  console.log(`  ${createdMatches.length} matches`);
  console.log(`  ${acceptedMatches.length} conversations with messages`);
  console.log(`  2 relationships`);
  console.log(`  ${createdDynamics.length} dynamics`);
  console.log(`  ${pollDynamics} poll dynamics`);
  console.log(`  ${totalLikes} likes`);
  console.log(`  ${totalComments} comments`);
  console.log(`  ${totalPollVotes} poll votes`);
  console.log('\nAdmin account (password: 123456):');
  console.log('  管理员     admin@linksoul.com');
  console.log('\nTest accounts (password: 123456):');
  for (const u of users) {
    console.log(`  ${u.nickname.padEnd(8)} ${u.email}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
