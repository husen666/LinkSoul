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

async function main() {
  console.log('Seeding database...\n');

  // Clear existing data
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.match.deleteMany();
  await prisma.creditLog.deleteMany();
  await prisma.creditScore.deleteMany();
  await prisma.report.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await hash('123456', 12);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
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
  console.log(`  Created admin: ${admin.nickname} (${admin.email})`);

  const createdUsers: any[] = [];

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

  console.log('\nSeed completed!');
  console.log(`  ${createdUsers.length} users`);
  console.log(`  ${createdMatches.length} matches`);
  console.log(`  ${acceptedMatches.length} conversations with messages`);
  console.log(`  2 relationships`);
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
