import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hash, compare } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { APP_VERSION } from '../../version';
import {
  generateDefaultAvatar,
  pickAvatarStyle,
} from '../../common/utils/avatar.util';

const MAX_PAGE_SIZE = 100;
const MAX_ANALYTICS_DAYS = 90;
const USER_STATUS_SET = new Set([
  'ACTIVE',
  'INACTIVE',
  'BANNED',
  'DEACTIVATED',
]);
const MATCH_STATUS_SET = new Set([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
]);
const REPORT_STATUS_SET = new Set([
  'PENDING',
  'REVIEWED',
  'RESOLVED',
  'DISMISSED',
]);
const HEALTH_SERVICE_URLS: Record<string, string> = {
  backend: 'http://localhost:3000/api/v1/health',
  ai: 'http://localhost:8000/health',
  mobile: 'http://localhost:8081',
  admin: 'http://localhost:5174',
};

function clampPage(page: any, pageSize: any, defaultPs = 20) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(pageSize) || defaultPs),
  );
  return { p, ps };
}

function assertEnumValue(
  value: string,
  validSet: Set<string>,
  fieldLabel: string,
) {
  if (!validSet.has(value)) {
    throw new BadRequestException(`${fieldLabel} 不合法: ${value}`);
  }
}

function isValidHttpUrl(url: string) {
  return /^https?:\/\/.+/i.test(url);
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private async assertSuperAdmin(adminId: string) {
    const firstAdmin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!firstAdmin || firstAdmin.id !== adminId) {
      throw new ForbiddenException('仅超级管理员可执行该操作');
    }
  }

  async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      totalMatches,
      acceptedMatches,
      pendingMatches,
      totalConversations,
      totalMessages,
      totalReports,
      pendingReports,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { role: 'USER', status: 'BANNED' } }),
      this.prisma.match.count(),
      this.prisma.match.count({ where: { status: 'ACCEPTED' } }),
      this.prisma.match.count({ where: { status: 'PENDING' } }),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.report.count(),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayUsers, todayMatches, todayMessages] = await Promise.all([
      this.prisma.user.count({
        where: { role: 'USER', createdAt: { gte: todayStart } },
      }),
      this.prisma.match.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    const recentUsers = await this.prisma.user.findMany({
      where: { role: 'USER' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        nickname: true,
        email: true,
        phone: true,
        avatar: true,
        gender: true,
        city: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    const last7days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const trendData = await Promise.all(
      last7days.map(async (dayStart, idx) => {
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const [users, matches, messages] = await Promise.all([
          this.prisma.user.count({
            where: { createdAt: { gte: dayStart, lt: dayEnd } },
          }),
          this.prisma.match.count({
            where: { createdAt: { gte: dayStart, lt: dayEnd } },
          }),
          this.prisma.message.count({
            where: { createdAt: { gte: dayStart, lt: dayEnd } },
          }),
        ]);
        return {
          date: dayStart.toISOString().slice(0, 10),
          label: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`,
          users,
          matches,
          messages,
        };
      }),
    );

    const testCompleted = await this.prisma.userProfile.count({
      where: { testCompleted: true },
    });
    const totalProfiles = await this.prisma.userProfile.count();
    const testCompletionRate =
      totalProfiles > 0 ? Math.round((testCompleted / totalProfiles) * 100) : 0;

    return {
      overview: {
        totalUsers,
        activeUsers,
        bannedUsers,
        totalMatches,
        acceptedMatches,
        pendingMatches,
        totalConversations,
        totalMessages,
        totalReports,
        pendingReports,
        testCompletionRate,
      },
      today: { todayUsers, todayMatches, todayMessages },
      recentUsers,
      trendData,
    };
  }

  // ─── User Management ───

  async getUsers(page = 1, pageSize = 20, search?: string, status?: string) {
    const { p, ps } = clampPage(page, pageSize);
    const where: any = { role: 'USER' };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { nickname: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        select: {
          id: true,
          email: true,
          phone: true,
          nickname: true,
          avatar: true,
          gender: true,
          bio: true,
          city: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          profile: {
            select: {
              testCompleted: true,
              attachmentType: true,
              communicationStyle: true,
            },
          },
          creditScore: { select: { score: true, level: true } },
          _count: {
            select: {
              sentMatches: true,
              receivedMatches: true,
              messages: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        nickname: true,
        avatar: true,
        gender: true,
        bio: true,
        city: true,
        province: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        profile: true,
        creditScore: true,
        creditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        sentMatches: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            userB: { select: { id: true, nickname: true, avatar: true } },
          },
        },
        receivedMatches: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            userA: { select: { id: true, nickname: true, avatar: true } },
          },
        },
        sentReports: {
          take: 10,
          include: { reported: { select: { id: true, nickname: true } } },
        },
        receivedReports: {
          take: 10,
          include: { reporter: { select: { id: true, nickname: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async updateUserStatus(userId: string, status: string) {
    assertEnumValue(status, USER_STATUS_SET, '用户状态');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: status as any },
      select: { id: true, nickname: true, status: true },
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.role === 'ADMIN')
      throw new BadRequestException('不能通过此接口删除管理员');

    const matchIds = (
      await this.prisma.match.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: { id: true },
      })
    ).map((m) => m.id);

    const convIds =
      matchIds.length > 0
        ? (
            await this.prisma.conversation.findMany({
              where: { matchId: { in: matchIds } },
              select: { id: true },
            })
          ).map((c) => c.id)
        : [];

    await this.prisma.$transaction([
      ...(convIds.length > 0
        ? [
            this.prisma.message.deleteMany({
              where: { conversationId: { in: convIds } },
            }),
          ]
        : []),
      ...(convIds.length > 0
        ? [
            this.prisma.conversation.deleteMany({
              where: { id: { in: convIds } },
            }),
          ]
        : []),
      ...(matchIds.length > 0
        ? [this.prisma.match.deleteMany({ where: { id: { in: matchIds } } })]
        : []),
      this.prisma.soulMessage.deleteMany({ where: { session: { userId } } }),
      this.prisma.soulSession.deleteMany({ where: { userId } }),
      this.prisma.report.deleteMany({
        where: { OR: [{ reporterId: userId }, { reportedId: userId }] },
      }),
      this.prisma.creditLog.deleteMany({ where: { userId } }),
      this.prisma.creditScore.deleteMany({ where: { userId } }),
      this.prisma.userProfile.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { success: true };
  }

  async resetUserPassword(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    const tempPwd = randomBytes(4).toString('hex');
    const hashed = await hash(tempPwd, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    return { success: true, tempPassword: tempPwd };
  }

  // ─── Match Management ───

  async getMatches(page = 1, pageSize = 20, search?: string, status?: string) {
    const { p, ps } = clampPage(page, pageSize);
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { userA: { nickname: { contains: search } } },
        { userB: { nickname: { contains: search } } },
      ];
    }

    const [matches, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        include: {
          userA: { select: { id: true, nickname: true, avatar: true } },
          userB: { select: { id: true, nickname: true, avatar: true } },
          conversation: {
            select: { id: true, _count: { select: { messages: true } } },
          },
          relationship: { select: { stage: true, progressScore: true } },
        },
      }),
      this.prisma.match.count({ where }),
    ]);

    return {
      matches,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  async updateMatchStatus(matchId: string, status: string) {
    assertEnumValue(status, MATCH_STATUS_SET, '匹配状态');
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true },
    });
    if (!match) throw new NotFoundException('匹配不存在');
    return this.prisma.match.update({
      where: { id: matchId },
      data: { status: status as any },
      select: { id: true, status: true },
    });
  }

  // ─── Report Management ───

  async getReports(
    page = 1,
    pageSize = 20,
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { p, ps } = clampPage(page, pageSize);
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { reporter: { nickname: { contains: search } } },
        { reported: { nickname: { contains: search } } },
        { reason: { contains: search } },
      ];
    }
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          createdAt.gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          createdAt.lte = end;
        }
      }
      if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        include: {
          reporter: { select: { id: true, nickname: true, avatar: true } },
          reported: { select: { id: true, nickname: true, avatar: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      reports,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  async updateReportStatus(
    reportId: string,
    status: string,
    resolution?: string,
  ) {
    assertEnumValue(status, REPORT_STATUS_SET, '举报状态');
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true },
    });
    if (!report) throw new NotFoundException('举报不存在');
    return this.prisma.report.update({
      where: { id: reportId },
      data: { status: status as any, resolution },
      include: {
        reporter: { select: { id: true, nickname: true } },
        reported: { select: { id: true, nickname: true } },
      },
    });
  }

  async resolveReportWithBan(reportId: string, resolution: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('举报不存在');

    const [updatedReport] = await this.prisma.$transaction([
      this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'RESOLVED', resolution },
        include: {
          reporter: { select: { id: true, nickname: true } },
          reported: { select: { id: true, nickname: true } },
        },
      }),
      this.prisma.user.update({
        where: { id: report.reportedId },
        data: { status: 'BANNED' },
      }),
    ]);
    return updatedReport;
  }

  // ─── Conversation Management ───

  async getConversations(
    page = 1,
    pageSize = 20,
    search?: string,
    type?: string,
  ) {
    const { p, ps } = clampPage(page, pageSize);
    const where: any = {};

    if (search) {
      where.match = {
        OR: [
          { userA: { nickname: { contains: search } } },
          { userB: { nickname: { contains: search } } },
        ],
      };
    }
    if (type) where.type = type;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        include: {
          match: {
            include: {
              userA: { select: { id: true, nickname: true, avatar: true } },
              userB: { select: { id: true, nickname: true, avatar: true } },
            },
          },
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, createdAt: true },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      conversations,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  async getConversationMessages(
    conversationId: string,
    page = 1,
    pageSize = 50,
  ) {
    const { p, ps } = clampPage(page, pageSize, 50);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('对话不存在');

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: (p - 1) * ps,
        take: ps,
        include: {
          sender: { select: { id: true, nickname: true, avatar: true } },
        },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      messages,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  // ─── Personality Test Stats ───

  async getPersonalityStats() {
    const total = await this.prisma.userProfile.count();
    const completed = await this.prisma.userProfile.count({
      where: { testCompleted: true },
    });

    const attachmentDist = await this.prisma.userProfile.groupBy({
      by: ['attachmentType'],
      where: { testCompleted: true, attachmentType: { not: null } },
      _count: true,
    });

    const commDist = await this.prisma.userProfile.groupBy({
      by: ['communicationStyle'],
      where: { testCompleted: true, communicationStyle: { not: null } },
      _count: true,
    });

    return {
      total,
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      attachmentDistribution: attachmentDist.map((a) => ({
        type: a.attachmentType,
        count: a._count,
      })),
      communicationDistribution: commDist.map((c) => ({
        type: c.communicationStyle,
        count: c._count,
      })),
    };
  }

  // ─── System Settings & Org ───

  async getSystemInfo() {
    const [userCount, adminCount, matchCount, msgCount, reportCount] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'USER' } }),
        this.prisma.user.count({ where: { role: 'ADMIN' } }),
        this.prisma.match.count(),
        this.prisma.message.count(),
        this.prisma.report.count(),
      ]);

    return {
      version: APP_VERSION,
      database: 'SQLite',
      userCount,
      adminCount,
      matchCount,
      messageCount: msgCount,
      reportCount,
      services: [
        {
          key: 'backend',
          name: 'Backend API',
          url: 'http://localhost:3000',
          status: 'running',
        },
        {
          key: 'ai',
          name: 'AI Service',
          url: 'http://localhost:8000',
          status: 'unknown',
        },
        {
          key: 'mobile',
          name: 'Mobile App',
          url: 'http://localhost:8081',
          status: 'unknown',
        },
        {
          key: 'admin',
          name: 'Admin Panel',
          url: 'http://localhost:5174',
          status: 'running',
        },
      ],
    };
  }

  async getAdminUsers() {
    return this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        nickname: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createAdminUser(
    email: string,
    password: string,
    nickname: string,
    requesterId: string,
  ) {
    await this.assertSuperAdmin(requesterId);
    if (!email || !password || !nickname)
      throw new BadRequestException('邮箱、密码、昵称不能为空');
    if (password.length < 6) throw new BadRequestException('密码至少 6 位');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('该邮箱已被使用');
    const hashed = await hash(password, 12);
    const avatar = generateDefaultAvatar(nickname, pickAvatarStyle(nickname));
    return this.prisma.user.create({
      data: {
        email,
        password: hashed,
        nickname,
        avatar,
        role: 'ADMIN',
        status: 'ACTIVE',
        profile: { create: { testCompleted: false } },
        creditScore: { create: { score: 0, level: 'BRONZE' } },
      },
      select: {
        id: true,
        nickname: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  // ─── Analytics ───

  async getAnalytics(days = 30) {
    const d = Math.min(MAX_ANALYTICS_DAYS, Math.max(1, Number(days) || 30));
    const since = new Date();
    since.setDate(since.getDate() - d);
    since.setHours(0, 0, 0, 0);

    const dateRange = Array.from({ length: d }, (_, i) => {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      return d;
    });

    const dailyData = await Promise.all(
      dateRange.map(async (dayStart) => {
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const range = { gte: dayStart, lt: dayEnd };

        const [newUsers, newMatches, newMessages, newReports] =
          await Promise.all([
            this.prisma.user.count({ where: { createdAt: range } }),
            this.prisma.match.count({ where: { createdAt: range } }),
            this.prisma.message.count({ where: { createdAt: range } }),
            this.prisma.report.count({ where: { createdAt: range } }),
          ]);

        return {
          date: dayStart.toISOString().slice(0, 10),
          label: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`,
          newUsers,
          newMatches,
          newMessages,
          newReports,
        };
      }),
    );

    const genderDist = await this.prisma.user.groupBy({
      by: ['gender'],
      where: { role: 'USER', gender: { not: null } },
      _count: true,
    });

    const statusDist = await this.prisma.user.groupBy({
      by: ['status'],
      where: { role: 'USER' },
      _count: true,
    });

    const matchStatusDist = await this.prisma.match.groupBy({
      by: ['status'],
      _count: true,
    });

    const cityDist = await this.prisma.user.groupBy({
      by: ['city'],
      where: { role: 'USER', city: { not: null } },
      _count: true,
      orderBy: { _count: { city: 'desc' } },
      take: 10,
    });

    return {
      dailyData,
      genderDistribution: genderDist.map((g) => ({
        type: g.gender || 'UNKNOWN',
        count: g._count,
      })),
      statusDistribution: statusDist.map((s) => ({
        type: s.status,
        count: s._count,
      })),
      matchStatusDistribution: matchStatusDist.map((m) => ({
        type: m.status,
        count: m._count,
      })),
      cityDistribution: cityDist.map((c) => ({
        city: c.city || '未知',
        count: c._count,
      })),
    };
  }

  // ─── Soul Sessions ───

  async getSoulSessions(page = 1, pageSize = 20, status?: string) {
    const { p, ps } = clampPage(page, pageSize);
    const where: any = {};
    if (status) where.status = status;

    const [sessions, total] = await Promise.all([
      this.prisma.soulSession.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
        },
      }),
      this.prisma.soulSession.count({ where }),
    ]);

    return {
      sessions,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  async getSoulSessionMessages(sessionId: string, page = 1, pageSize = 50) {
    const { p, ps } = clampPage(page, pageSize, 50);

    const session = await this.prisma.soulSession.findUnique({
      where: { id: sessionId },
      include: { user: { select: { id: true, nickname: true, avatar: true } } },
    });
    if (!session) throw new NotFoundException('会话不存在');

    const [messages, total] = await Promise.all([
      this.prisma.soulMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.soulMessage.count({ where: { sessionId } }),
    ]);

    return {
      session,
      messages,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  async takeSoulSession(sessionId: string, adminId: string) {
    const session = await this.prisma.soulSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    if (!session) throw new NotFoundException('会话不存在');
    if (session.status === 'CLOSED')
      throw new BadRequestException('会话已关闭');
    return this.prisma.soulSession.update({
      where: { id: sessionId },
      data: { status: 'HUMAN', adminId },
    });
  }

  async closeSoulSession(sessionId: string) {
    const session = await this.prisma.soulSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('会话不存在');
    return this.prisma.soulSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED' },
    });
  }

  async sendSoulMessage(sessionId: string, adminId: string, content: string) {
    if (!content?.trim()) throw new BadRequestException('消息内容不能为空');
    const session = await this.prisma.soulSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, adminId: true },
    });
    if (!session) throw new NotFoundException('会话不存在');
    if (session.status === 'CLOSED')
      throw new BadRequestException('会话已关闭');
    if (session.status !== 'HUMAN')
      throw new BadRequestException('请先接管会话后再回复');
    if (session.adminId !== adminId)
      throw new BadRequestException('仅接管该会话的管理员可以回复');
    return this.prisma.soulMessage.create({
      data: { sessionId, role: 'admin', content: content.trim() },
    });
  }

  // ─── Operational Messages ───

  async getOperationalMessages(page = 1, pageSize = 20, category?: string) {
    const { p, ps } = clampPage(page, pageSize);
    const where: any = {};
    if (category) where.category = category;

    const [messages, total] = await Promise.all([
      this.prisma.operationalMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.operationalMessage.count({ where }),
    ]);

    return {
      messages,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  async createOperationalMessage(data: {
    title: string;
    content: string;
    category: string;
    imageUrl?: string;
    linkUrl?: string;
    priority?: number;
  }) {
    const title = data.title?.trim();
    const content = data.content?.trim();
    if (!title) throw new BadRequestException('标题不能为空');
    if (title.length > 60) throw new BadRequestException('标题不能超过 60 字');
    if (!content) throw new BadRequestException('内容不能为空');
    if (content.length > 1000)
      throw new BadRequestException('内容不能超过 1000 字');
    if (data.imageUrl && !isValidHttpUrl(data.imageUrl))
      throw new BadRequestException('图片 URL 格式不正确');
    if (data.linkUrl && !isValidHttpUrl(data.linkUrl))
      throw new BadRequestException('链接 URL 格式不正确');
    const priority = Number(data.priority ?? 0);
    if (!Number.isFinite(priority) || priority < 0 || priority > 999) {
      throw new BadRequestException('优先级需在 0~999');
    }
    return this.prisma.operationalMessage.create({
      data: {
        title,
        content,
        category: data.category,
        imageUrl: data.imageUrl?.trim() || undefined,
        linkUrl: data.linkUrl?.trim() || undefined,
        priority,
        status: 'ACTIVE',
      },
    });
  }

  async updateOperationalMessage(id: string, data: any) {
    const msg = await this.prisma.operationalMessage.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!msg) throw new NotFoundException('运营消息不存在');
    const allowed: Record<string, true> = {
      title: true,
      content: true,
      category: true,
      imageUrl: true,
      linkUrl: true,
      priority: true,
      status: true,
    };
    const clean: any = {};
    for (const key of Object.keys(data)) {
      if (allowed[key]) clean[key] = data[key];
    }
    if (clean.title != null) {
      clean.title = String(clean.title).trim();
      if (!clean.title) throw new BadRequestException('标题不能为空');
      if (clean.title.length > 60)
        throw new BadRequestException('标题不能超过 60 字');
    }
    if (clean.content != null) {
      clean.content = String(clean.content).trim();
      if (!clean.content) throw new BadRequestException('内容不能为空');
      if (clean.content.length > 1000)
        throw new BadRequestException('内容不能超过 1000 字');
    }
    if (clean.imageUrl != null) {
      clean.imageUrl = String(clean.imageUrl).trim();
      if (clean.imageUrl && !isValidHttpUrl(clean.imageUrl))
        throw new BadRequestException('图片 URL 格式不正确');
      if (!clean.imageUrl) clean.imageUrl = null;
    }
    if (clean.linkUrl != null) {
      clean.linkUrl = String(clean.linkUrl).trim();
      if (clean.linkUrl && !isValidHttpUrl(clean.linkUrl))
        throw new BadRequestException('链接 URL 格式不正确');
      if (!clean.linkUrl) clean.linkUrl = null;
    }
    if (clean.priority != null) {
      const priority = Number(clean.priority);
      if (!Number.isFinite(priority) || priority < 0 || priority > 999) {
        throw new BadRequestException('优先级需在 0~999');
      }
      clean.priority = priority;
    }
    return this.prisma.operationalMessage.update({
      where: { id },
      data: clean,
    });
  }

  async deleteOperationalMessage(id: string) {
    const msg = await this.prisma.operationalMessage.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!msg) throw new NotFoundException('运营消息不存在');
    return this.prisma.operationalMessage.delete({ where: { id } });
  }

  // ─── Admin Audit Log ───

  async writeLog(
    adminId: string,
    action: string,
    target?: string,
    targetId?: string,
    detail?: string,
    ip?: string,
  ) {
    return this.prisma.adminLog.create({
      data: { adminId, action, target, targetId, detail, ip },
    });
  }

  async changeAdminPassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!currentPassword || !newPassword)
      throw new BadRequestException('请填写当前密码和新密码');
    if (newPassword.length < 6)
      throw new BadRequestException('新密码至少 6 位');
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, password: true },
    });
    if (!admin) throw new NotFoundException('账号不存在');
    const valid = await compare(currentPassword, admin.password);
    if (!valid) throw new BadRequestException('当前密码错误');
    const hashed = await hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: adminId },
      data: { password: hashed },
    });
    return { success: true };
  }

  async deleteAdmin(adminId: string, requesterId: string) {
    await this.assertSuperAdmin(requesterId);
    if (adminId === requesterId)
      throw new BadRequestException('不能删除自己的账号');
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, role: true },
    });
    if (!admin) throw new NotFoundException('管理员不存在');
    if (admin.role !== 'ADMIN')
      throw new BadRequestException('该用户不是管理员');
    const count = await this.prisma.user.count({ where: { role: 'ADMIN' } });
    if (count <= 1) throw new BadRequestException('至少需要保留一个管理员');
    await this.prisma.user.update({
      where: { id: adminId },
      data: { role: 'USER' },
    });
    return { success: true };
  }

  async checkServiceHealth(serviceKey: string) {
    const url = HEALTH_SERVICE_URLS[serviceKey];
    if (!url) throw new BadRequestException('不支持的服务标识');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      return {
        serviceKey,
        url,
        status: res.ok ? 'running' : 'error',
        statusCode: res.status,
      };
    } catch {
      return { serviceKey, url, status: 'offline', statusCode: 0 };
    }
  }

  async exportUsers() {
    return this.prisma.user.findMany({
      where: { role: 'USER' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nickname: true,
        email: true,
        phone: true,
        gender: true,
        city: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        creditScore: { select: { score: true, level: true } },
        profile: {
          select: {
            testCompleted: true,
            attachmentType: true,
            communicationStyle: true,
          },
        },
        _count: {
          select: { sentMatches: true, receivedMatches: true, messages: true },
        },
      },
    });
  }

  async getAuditLogs(
    page = 1,
    pageSize = 30,
    action?: string,
    adminSearch?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { p, ps } = clampPage(page, pageSize, 30);
    const where: any = {};
    if (action) where.action = action;
    if (adminSearch) {
      where.admin = { nickname: { contains: adminSearch } };
    }
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          createdAt.gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          createdAt.lte = end;
        }
      }
      if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      this.prisma.adminLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.adminLog.count({ where }),
    ]);

    const adminIds = [...new Set(logs.map((l) => l.adminId))];
    const admins =
      adminIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, nickname: true, avatar: true },
          })
        : [];
    const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));

    return {
      logs: logs.map((l) => ({ ...l, admin: adminMap[l.adminId] || null })),
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  async exportAuditLogs(
    action?: string,
    adminSearch?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = {};
    if (action) where.action = action;
    if (adminSearch) {
      where.admin = { nickname: { contains: adminSearch } };
    }
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          createdAt.gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          createdAt.lte = end;
        }
      }
      if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
    }

    const logs = await this.prisma.adminLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const adminIds = [...new Set(logs.map((l) => l.adminId))];
    const admins =
      adminIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, nickname: true, avatar: true },
          })
        : [];
    const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));
    return {
      logs: logs.map((l) => ({ ...l, admin: adminMap[l.adminId] || null })),
      total: logs.length,
    };
  }
}
