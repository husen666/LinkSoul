import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  pickRandomAvatarFromBatch,
} from '../../common/utils/avatar.util';

@Injectable()
export class AuthService {
  private generateAiNickname(input?: string) {
    const vibes = [
      '灵链',
      '星火',
      '月光',
      '量子',
      '共振',
      '云端',
      '夜航',
      '心流',
    ];
    const roles = [
      '旅人',
      '听风者',
      '观察员',
      '信号体',
      '同行者',
      '探索者',
      '漫游者',
      '记录者',
    ];
    const seed = (input || '').trim();
    if (seed) {
      const base = seed.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').slice(0, 6);
      const suffix = String(Math.floor(Math.random() * 9000) + 1000);
      return `${base}${suffix}`;
    }
    const left = vibes[Math.floor(Math.random() * vibes.length)];
    const right = roles[Math.floor(Math.random() * roles.length)];
    const suffix = String(Math.floor(Math.random() * 900) + 100);
    return `${left}${right}${suffix}`;
  }

  private async writeAdminAuthLog(
    action: string,
    adminId: string,
    detail: string,
  ) {
    await this.prisma.adminLog
      .create({
        data: { adminId, action, target: 'admin_auth', detail },
      })
      .catch(() => {});
  }

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private computeCreditLevel(
    score: number,
  ): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
    if (score >= 95) return 'PLATINUM';
    if (score >= 80) return 'GOLD';
    if (score >= 60) return 'SILVER';
    return 'BRONZE';
  }

  async register(dto: RegisterDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('请输入手机号或邮箱');
    }

    if (dto.phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existing) throw new ConflictException('该手机号已注册');
    }

    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) throw new ConflictException('该邮箱已注册');
    }

    const hashedPassword = await hash(dto.password, 12);
    const nickname = this.generateAiNickname(
      dto.nickname || dto.phone || dto.email,
    );
    const avatar = pickRandomAvatarFromBatch(nickname, { perStyle: 4 });

    const initScore = 0;
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        email: dto.email,
        password: hashedPassword,
        nickname,
        avatar,
        profile: { create: {} },
        creditScore: {
          create: {
            score: initScore,
            level: this.computeCreditLevel(initScore),
          },
        },
      },
      select: {
        id: true,
        phone: true,
        email: true,
        nickname: true,
        avatar: true,
      },
    });

    const token = this.generateToken(user.id);

    return { user, token };
  }

  async login(dto: LoginDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('请输入手机号或邮箱');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.phone ? [{ phone: dto.phone }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });

    if (!user) throw new UnauthorizedException('账号不存在，请先注册');

    const valid = await compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('密码错误，请重试');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    let avatar = user.avatar;
    if (!avatar) {
      avatar = pickRandomAvatarFromBatch(user.nickname, { perStyle: 4 });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { avatar },
      });
    }

    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        nickname: user.nickname,
        avatar,
      },
      token,
    };
  }

  async adminLogin(dto: LoginDto) {
    try {
      const result = await this.login(dto);
      const user = await this.prisma.user.findUnique({
        where: { id: result.user.id },
        select: { role: true, status: true, id: true, email: true },
      });
      if (!user || user.status !== 'ACTIVE' || user.role !== 'ADMIN') {
        await this.writeAdminAuthLog(
          'ADMIN_LOGIN_DENIED',
          user?.id || 'SYSTEM',
          `后台登录拒绝: ${dto.email || dto.phone || 'unknown'}`,
        );
        throw new UnauthorizedException('仅管理员可登录后台');
      }
      await this.writeAdminAuthLog(
        'ADMIN_LOGIN_SUCCESS',
        user.id,
        `管理员登录成功: ${user.email || user.id}`,
      );
      return result;
    } catch (e) {
      await this.writeAdminAuthLog(
        'ADMIN_LOGIN_FAILED',
        'SYSTEM',
        `后台登录失败: ${dto.email || dto.phone || 'unknown'}`,
      );
      throw e;
    }
  }

  private generateToken(userId: string): string {
    return this.jwtService.sign({ sub: userId });
  }
}
