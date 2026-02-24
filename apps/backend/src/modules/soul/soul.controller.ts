import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SoulService } from './soul.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Soul')
@Controller('soul')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SoulController {
  constructor(private soulService: SoulService) {}

  // ── User endpoints ──

  @Post('sessions')
  @ApiOperation({ summary: '创建心灵会话' })
  createSession(
    @CurrentUser('id') userId: string,
    @Body('topic') topic: string,
    @Body('message') message: string,
  ) {
    return this.soulService.createSession(userId, topic || 'general', message);
  }

  @Get('sessions')
  @ApiOperation({ summary: '获取我的心灵会话列表' })
  getMySessions(@CurrentUser('id') userId: string) {
    return this.soulService.getMySessions(userId);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: '获取会话详情' })
  getSession(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.soulService.getSession(id, userId);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: '发送消息' })
  sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.soulService.sendMessage(id, userId, content);
  }

  @Post('sessions/:id/close')
  @ApiOperation({ summary: '关闭会话' })
  closeSession(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.soulService.closeSession(id, userId);
  }
}

// ── Admin endpoints ──

@ApiTags('Admin - Soul')
@Controller('admin/soul')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class SoulAdminController {
  constructor(private soulService: SoulService) {}

  @Get('sessions')
  @ApiOperation({ summary: '获取所有心灵会话' })
  getSessions(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.soulService.adminGetSessions(
      Number(page) || 1,
      Number(pageSize) || 20,
      status,
    );
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: '获取会话详情（含用户信息）' })
  getSession(@Param('id') id: string) {
    return this.soulService.adminGetSession(id);
  }

  @Post('sessions/:id/takeover')
  @ApiOperation({ summary: '人工接管会话' })
  takeover(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.soulService.adminTakeover(id, adminId);
  }

  @Post('sessions/:id/reply')
  @ApiOperation({ summary: '人工回复' })
  reply(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.soulService.adminReply(id, adminId, content);
  }

  @Post('sessions/:id/release')
  @ApiOperation({ summary: '释放为AI回复' })
  release(@Param('id') id: string) {
    return this.soulService.adminReleaseToAI(id);
  }

  @Post('sessions/:id/close')
  @ApiOperation({ summary: '关闭会话' })
  close(@Param('id') id: string) {
    return this.soulService.adminCloseSession(id);
  }
}
