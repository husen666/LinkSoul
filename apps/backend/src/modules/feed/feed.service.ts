import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

type FeedMode = 'latest' | 'hot' | 'resonance';

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService) {}

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
    if (dynamic.visibility === 'public') return dynamic;
    if (dynamic.userId === currentUserId) return dynamic;
    throw new ForbiddenException('无权限访问该动态');
  }

  async createPost(
    userId: string,
    data: {
      content: string;
      mood?: string;
      visibility?: string;
      imageUrl?: string;
    },
  ) {
    const content = data.content?.trim();
    if (!content) {
      throw new BadRequestException('动态内容不能为空');
    }
    if (content.length > 2000) {
      throw new BadRequestException('动态内容过长');
    }
    return this.prisma.dynamic.create({
      data: {
        userId,
        type: 'post',
        content,
        mood: data.mood || null,
        imageUrl: data.imageUrl || null,
        visibility: data.visibility || 'public',
      },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        _count: { select: { dynamicLikes: true } },
      },
    });
  }

  async getFeed(
    currentUserId: string,
    page = 1,
    pageSize = 20,
    mode?: string,
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

    const where = {
      OR: [{ visibility: 'public' }, { userId: currentUserId }],
    };

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
        },
      }),
      this.prisma.dynamic.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        type: item.type,
        content: item.content,
        mood: item.mood,
        imageUrl: item.imageUrl,
        visibility: item.visibility,
        likes: item.likes,
        createdAt: item.createdAt,
        user: item.user,
        likesCount: item._count.dynamicLikes,
        commentsCount: item._count.dynamicComments,
        liked: item.dynamicLikes.length > 0,
      })),
      total,
      page: safePage,
      pageSize: safePageSize,
      mode: safeMode,
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
        },
      })
      .then((items) =>
        items.map((item) => ({
          ...item,
          likesCount: item._count.dynamicLikes,
          commentsCount: item._count.dynamicComments || 0,
          liked: item.dynamicLikes.length > 0,
          dynamicLikes: undefined,
          _count: undefined,
        })),
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
