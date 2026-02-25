import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

type FeedMode = 'latest' | 'hot' | 'resonance';
type DynamicMediaType = 'image' | 'video';
type DynamicMediaItem = { type: DynamicMediaType; url: string };

type DynamicWithPoll = {
  id: string;
  userId: string;
  type: string;
  content: string;
  mood: string | null;
  imageUrl: string | null;
  mediaList: string | null;
  music: string | null;
  location: string | null;
  link: string | null;
  visibility: string;
  likes: number;
  createdAt: Date;
  user: { id: string; nickname: string; avatar: string | null };
  _count: { dynamicLikes: number; dynamicComments: number };
  dynamicLikes: { id: string }[];
  pollOptions: { id: string; text: string; sortOrder: number; votes: number }[];
  pollVotes?: { optionId: string; userId: string }[];
};

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService) {}

  private parseMediaList(
    raw: string | null | undefined,
    imageUrl: string | null | undefined,
  ): DynamicMediaItem[] {
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean: DynamicMediaItem[] = parsed
            .map((item: any): DynamicMediaItem => ({
              type: item?.type === 'video' ? 'video' : 'image',
              url: String(item?.url || '').trim(),
            }))
            .filter((item) => Boolean(item.url))
            .slice(0, 9);
          if (clean.length > 0) return clean;
        }
      } catch {
        // ignore invalid old data
      }
    }
    if (imageUrl) return [{ type: 'image', url: imageUrl }];
    return [];
  }

  private mapDynamicItem(item: DynamicWithPoll) {
    const votedOptionId =
      item.pollVotes && item.pollVotes.length > 0 ? item.pollVotes[0].optionId : null;
    const totalVotes = item.pollOptions.reduce((sum, opt) => sum + opt.votes, 0);
    const poll =
      item.pollOptions.length > 0
        ? {
            totalVotes,
            votedOptionId,
            options: item.pollOptions.map((opt) => ({
              id: opt.id,
              text: opt.text,
              votes: opt.votes,
            })),
          }
        : null;

    return {
      id: item.id,
      userId: item.userId,
      type: item.type,
      content: item.content,
      mood: item.mood,
      imageUrl: item.imageUrl,
      mediaList: this.parseMediaList(item.mediaList, item.imageUrl),
      music: item.music,
      location: item.location,
      link: item.link,
      poll,
      visibility: item.visibility,
      likes: item.likes,
      createdAt: item.createdAt,
      user: item.user,
      likesCount: item._count.dynamicLikes,
      commentsCount: item._count.dynamicComments,
      liked: item.dynamicLikes.length > 0,
    };
  }

  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    });
    return rows.map((row) =>
      row.blockerId === userId ? row.blockedId : row.blockerId,
    );
  }

  private normalizePage(page: number) {
    if (!Number.isFinite(page) || page < 1) return 1;
    return Math.floor(page);
  }

  private normalizePageSize(pageSize: number, max = 50, fallback = 20) {
    if (!Number.isFinite(pageSize) || pageSize < 1) return fallback;
    return Math.min(max, Math.floor(pageSize));
  }

  private normalizeMode(mode?: string): FeedMode {
    if (mode === 'hot' || mode === 'resonance') return mode;
    return 'latest';
  }

  private async assertDynamicVisible(dynamicId: string, currentUserId: string) {
    const dynamic = await this.prisma.dynamic.findUnique({
      where: { id: dynamicId },
    });
    if (!dynamic) throw new NotFoundException('Dynamic not found');
    if (dynamic.userId === currentUserId) return dynamic;
    const blocked = await this.prisma.userBlock.count({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: dynamic.userId },
          { blockerId: dynamic.userId, blockedId: currentUserId },
        ],
      },
    });
    if (blocked > 0) {
      throw new ForbiddenException('你与对方存在拉黑关系');
    }
    if (dynamic.visibility === 'public') return dynamic;
    throw new ForbiddenException('无权限访问该动态');
  }

  async createPost(
    userId: string,
    data: {
      content: string;
      mood?: string;
      visibility?: string;
      imageUrl?: string;
      mediaList?: DynamicMediaItem[];
      music?: string;
      location?: string;
      link?: string;
      pollOptions?: string[];
    },
  ) {
    const content = data.content?.trim();
    if (!content) {
      throw new BadRequestException('动态内容不能为空');
    }
    if (content.length > 2000) {
      throw new BadRequestException('动态内容过长');
    }
    const music = data.music?.trim() || null;
    const location = data.location?.trim() || null;
    const link = data.link?.trim() || null;
    const mediaList = (data.mediaList || [])
      .map((m) => ({
        type: m?.type === 'video' ? 'video' : 'image',
        url: String(m?.url || '').trim(),
      }))
      .filter((m) => Boolean(m.url))
      .slice(0, 9);
    const pollOptions = (data.pollOptions || [])
      .map((text) => text?.trim())
      .filter((text): text is string => Boolean(text));
    if (pollOptions.length === 1) {
      throw new BadRequestException('投票至少需要 2 个选项');
    }
    if (pollOptions.length > 6) {
      throw new BadRequestException('投票最多 6 个选项');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const dynamic = await tx.dynamic.create({
        data: {
          userId,
          type: 'post',
          content,
          mood: data.mood || null,
          imageUrl:
            mediaList.find((m) => m.type === 'image')?.url || data.imageUrl || null,
          mediaList: mediaList.length > 0 ? JSON.stringify(mediaList) : null,
          music,
          location,
          link,
          visibility: data.visibility || 'public',
        },
      });
      if (pollOptions.length >= 2) {
        await tx.dynamicPollOption.createMany({
          data: pollOptions.map((text, idx) => ({
            dynamicId: dynamic.id,
            text,
            sortOrder: idx,
          })),
        });
      }
      return dynamic;
    });

    const item = await this.prisma.dynamic.findUnique({
      where: { id: created.id },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        _count: { select: { dynamicLikes: true, dynamicComments: true } },
        dynamicLikes: {
          where: { userId },
          select: { id: true },
        },
        pollOptions: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, text: true, sortOrder: true, votes: true },
        },
        pollVotes: {
          where: { userId },
          select: { optionId: true, userId: true },
        },
      },
    });
    if (!item) throw new NotFoundException('Dynamic not found');
    return this.mapDynamicItem(item as DynamicWithPoll);
  }

  async getFeed(
    currentUserId: string,
    page = 1,
    pageSize = 20,
    mode?: string,
    cursor?: string,
  ) {
    const safePage = this.normalizePage(page);
    const safePageSize = this.normalizePageSize(pageSize, 50, 20);
    const safeMode = this.normalizeMode(mode);
    const skip = (safePage - 1) * safePageSize;

    const orderBy =
      safeMode === 'hot'
        ? [{ likes: 'desc' as const }, { createdAt: 'desc' as const }]
        : safeMode === 'resonance'
          ? [
              { dynamicComments: { _count: 'desc' as const } },
              { likes: 'desc' as const },
              { createdAt: 'desc' as const },
            ]
          : [{ createdAt: 'desc' as const }];

    const blockedUserIds = await this.getBlockedUserIds(currentUserId);
    const where: any = {
      OR: [{ visibility: 'public' }, { userId: currentUserId }],
    };
    if (blockedUserIds.length > 0) {
      where.userId = { notIn: blockedUserIds };
    }

    if (cursor) {
      if (safeMode !== 'latest') {
        throw new BadRequestException('cursor 分页仅支持 latest 模式');
      }
      const cursorRow = await this.prisma.dynamic.findUnique({
        where: { id: cursor },
        select: { id: true, createdAt: true },
      });
      if (!cursorRow) {
        throw new BadRequestException('无效 cursor');
      }
      const cursorWhere = {
        AND: [
          where,
          {
            OR: [
              { createdAt: { lt: cursorRow.createdAt } },
              { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
            ],
          },
        ],
      };
      const items = await this.prisma.dynamic.findMany({
        where: cursorWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: safePageSize + 1,
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          _count: { select: { dynamicLikes: true, dynamicComments: true } },
          dynamicLikes: {
            where: { userId: currentUserId },
            select: { id: true },
          },
          pollOptions: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, text: true, sortOrder: true, votes: true },
          },
          pollVotes: {
            where: { userId: currentUserId },
            select: { optionId: true, userId: true },
          },
        },
      });
      const hasMore = items.length > safePageSize;
      const pageItems = hasMore ? items.slice(0, safePageSize) : items;
      return {
        items: pageItems.map((item) => this.mapDynamicItem(item as DynamicWithPoll)),
        total: null,
        page: null,
        pageSize: safePageSize,
        mode: safeMode,
        hasMore,
        nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null,
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.dynamic.findMany({
        where,
        orderBy,
        skip,
        take: safePageSize,
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          _count: { select: { dynamicLikes: true, dynamicComments: true } },
          dynamicLikes: {
            where: { userId: currentUserId },
            select: { id: true },
          },
          pollOptions: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, text: true, sortOrder: true, votes: true },
          },
          pollVotes: {
            where: { userId: currentUserId },
            select: { optionId: true, userId: true },
          },
        },
      }),
      this.prisma.dynamic.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapDynamicItem(item as DynamicWithPoll)),
      total,
      page: safePage,
      pageSize: safePageSize,
      mode: safeMode,
      hasMore: skip + items.length < total,
      nextCursor: items.length ? items[items.length - 1].id : null,
    };
  }

  async getMyDynamics(userId: string) {
    return this.prisma.dynamic
      .findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          _count: { select: { dynamicLikes: true, dynamicComments: true } },
          dynamicLikes: {
            where: { userId },
            select: { id: true },
          },
          pollOptions: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, text: true, sortOrder: true, votes: true },
          },
          pollVotes: {
            where: { userId },
            select: { optionId: true, userId: true },
          },
        },
      })
      .then((items) =>
        items.map((item) => this.mapDynamicItem(item as DynamicWithPoll)),
      );
  }

  async toggleLike(dynamicId: string, userId: string) {
    await this.assertDynamicVisible(dynamicId, userId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dynamicLike.findUnique({
        where: { dynamicId_userId: { dynamicId, userId } },
      });

      if (existing) {
        await tx.dynamicLike.delete({ where: { id: existing.id } });
        const current = await tx.dynamic.findUnique({
          where: { id: dynamicId },
          select: { likes: true },
        });
        await tx.dynamic.update({
          where: { id: dynamicId },
          data: { likes: Math.max((current?.likes || 0) - 1, 0) },
        });
        return { liked: false };
      }

      await tx.dynamicLike.create({ data: { dynamicId, userId } });
      await tx.dynamic.update({
        where: { id: dynamicId },
        data: { likes: { increment: 1 } },
      });
      return { liked: true };
    });
  }

  async deletePost(dynamicId: string, userId: string) {
    const dynamic = await this.prisma.dynamic.findUnique({
      where: { id: dynamicId },
    });
    if (!dynamic) throw new NotFoundException('Dynamic not found');
    if (dynamic.userId !== userId) throw new ForbiddenException();
    await this.prisma.dynamic.delete({ where: { id: dynamicId } });
    return { deleted: true };
  }

  async generateSystemDynamic(userId: string, type: string, content: string) {
    return this.prisma.dynamic.create({
      data: { userId, type, content, visibility: 'public' },
    });
  }

  async getComments(
    dynamicId: string,
    currentUserId: string,
    page = 1,
    pageSize = 100,
  ) {
    await this.assertDynamicVisible(dynamicId, currentUserId);
    const safePage = this.normalizePage(page);
    const safePageSize = this.normalizePageSize(pageSize, 100, 100);
    const skip = (safePage - 1) * safePageSize;

    return this.prisma.dynamicComment.findMany({
      where: { dynamicId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: safePageSize,
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });
  }

  async getCommentsPage(
    dynamicId: string,
    currentUserId: string,
    page = 1,
    pageSize = 20,
  ) {
    await this.assertDynamicVisible(dynamicId, currentUserId);
    const safePage = this.normalizePage(page);
    const safePageSize = this.normalizePageSize(pageSize, 100, 20);
    const skip = (safePage - 1) * safePageSize;
    const [items, total] = await Promise.all([
      this.prisma.dynamicComment.findMany({
        where: { dynamicId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: safePageSize,
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
        },
      }),
      this.prisma.dynamicComment.count({ where: { dynamicId } }),
    ]);
    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      hasMore: skip + items.length < total,
    };
  }

  async votePoll(dynamicId: string, userId: string, optionId: string) {
    await this.assertDynamicVisible(dynamicId, userId);
    const chosenOptionId = optionId?.trim();
    if (!chosenOptionId) {
      throw new BadRequestException('缺少投票选项');
    }

    return this.prisma.$transaction(async (tx) => {
      const options = await tx.dynamicPollOption.findMany({
        where: { dynamicId },
        orderBy: { sortOrder: 'asc' },
      });
      if (options.length < 2) {
        throw new BadRequestException('该动态未设置投票');
      }
      const nextOption = options.find((opt) => opt.id === chosenOptionId);
      if (!nextOption) {
        throw new BadRequestException('投票选项不存在');
      }

      const existingVote = await tx.dynamicPollVote.findUnique({
        where: {
          dynamicId_userId: { dynamicId, userId },
        },
      });

      if (existingVote?.optionId === chosenOptionId) {
        return {
          voted: true,
          poll: {
            totalVotes: options.reduce((sum, opt) => sum + opt.votes, 0),
            votedOptionId: chosenOptionId,
            options: options.map((opt) => ({
              id: opt.id,
              text: opt.text,
              votes: opt.votes,
            })),
          },
        };
      }

      if (existingVote) {
        const prev = options.find((opt) => opt.id === existingVote.optionId);
        if (prev) {
          await tx.dynamicPollOption.update({
            where: { id: prev.id },
            data: { votes: Math.max(prev.votes - 1, 0) },
          });
        }
        await tx.dynamicPollVote.update({
          where: { id: existingVote.id },
          data: { optionId: chosenOptionId },
        });
      } else {
        await tx.dynamicPollVote.create({
          data: { dynamicId, userId, optionId: chosenOptionId },
        });
      }

      await tx.dynamicPollOption.update({
        where: { id: chosenOptionId },
        data: { votes: { increment: 1 } },
      });

      const latestOptions = await tx.dynamicPollOption.findMany({
        where: { dynamicId },
        orderBy: { sortOrder: 'asc' },
      });
      return {
        voted: true,
        poll: {
          totalVotes: latestOptions.reduce((sum, opt) => sum + opt.votes, 0),
          votedOptionId: chosenOptionId,
          options: latestOptions.map((opt) => ({
            id: opt.id,
            text: opt.text,
            votes: opt.votes,
          })),
        },
      };
    });
  }

  async addComment(dynamicId: string, userId: string, content: string) {
    await this.assertDynamicVisible(dynamicId, userId);
    const text = content?.trim();
    if (!text) throw new BadRequestException('评论内容不能为空');
    if (text.length > 500) throw new BadRequestException('评论内容过长');

    return this.prisma.dynamicComment.create({
      data: { dynamicId, userId, content: text },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });
  }
}
