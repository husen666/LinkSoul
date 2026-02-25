import {
  UnauthorizedException,
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Request } from 'express';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateMatchStatusDto } from './dto/update-match-status.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ResolveReportBanDto } from './dto/resolve-report-ban.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { SendSoulMessageDto } from './dto/send-soul-message.dto';
import { CreateOpMessageDto } from './dto/create-op-message.dto';
import { UpdateOpMessageDto } from './dto/update-op-message.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { HealthCheckDto } from './dto/health-check.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { ADMIN_THROTTLE } from './admin-throttle.config';
import { RepairDataDto } from './dto/repair-data.dto';
import { UpdateAvatarPoolConfigDto } from './dto/update-avatar-pool-config.dto';
import { GenerateDefaultAvatarsDto } from './dto/generate-default-avatars.dto';

type ReqUser = { id?: string; sub?: string };
type ReqWithUser = Request & { user?: ReqUser };

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

  private requireAdminId(req: ReqWithUser) {
    const adminId = req.user?.id || req.user?.sub;
    if (!adminId) throw new UnauthorizedException('管理员身份无效');
    return adminId;
  }

  private log(
    req: ReqWithUser,
    action: string,
    target?: string,
    targetId?: string,
    detail?: string,
  ) {
    const adminId = req.user?.id || req.user?.sub;
    if (adminId) {
      this.adminService
        .writeLog(adminId, action, target, targetId, detail, req.ip)
        .catch(() => {});
    }
  }

  @Get('dashboard')
  @ApiOperation({ summary: '仪表盘数据' })
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ─── Users ───

  @Get('users')
  @ApiOperation({ summary: '用户列表' })
  getUsers(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getUsers(page, pageSize, search, status);
  }

  @Get('users/:id')
  @ApiOperation({ summary: '用户详情' })
  getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: '更新用户状态' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto,
    @Req() req: ReqWithUser,
  ) {
    const result = await this.adminService.updateUserStatus(id, body.status);
    this.log(
      req,
      'UPDATE_USER_STATUS',
      'user',
      id,
      `状态变更为 ${body.status}`,
    );
    return result;
  }

  @Delete('users/:id')
  @ApiOperation({ summary: '删除用户' })
  @Throttle({ default: ADMIN_THROTTLE.deleteUser })
  async deleteUser(@Param('id') id: string, @Req() req: ReqWithUser) {
    const result = await this.adminService.deleteUser(id);
    this.log(req, 'DELETE_USER', 'user', id, '永久删除用户');
    return result;
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: '重置用户密码' })
  @Throttle({ default: ADMIN_THROTTLE.resetPassword })
  async resetPassword(@Param('id') id: string, @Req() req: ReqWithUser) {
    const result = await this.adminService.resetUserPassword(id);
    this.log(req, 'RESET_PASSWORD', 'user', id, '重置用户密码');
    return result;
  }

  // ─── Matches ───

  @Get('matches')
  @ApiOperation({ summary: '匹配列表' })
  getMatches(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getMatches(page, pageSize, search, status);
  }

  @Put('matches/:id/status')
  @ApiOperation({ summary: '更新匹配状态' })
  async updateMatchStatus(
    @Param('id') id: string,
    @Body() body: UpdateMatchStatusDto,
    @Req() req: ReqWithUser,
  ) {
    const result = await this.adminService.updateMatchStatus(id, body.status);
    this.log(
      req,
      'UPDATE_MATCH_STATUS',
      'match',
      id,
      `匹配状态变更为 ${body.status}`,
    );
    return result;
  }

  // ─── Reports ───

  @Get('reports')
  @ApiOperation({ summary: '举报列表' })
  getReports(@Query() query: QueryReportsDto) {
    return this.adminService.getReports(
      query.page,
      query.pageSize,
      query.status,
      query.search,
      query.startDate,
      query.endDate,
    );
  }

  @Put('reports/:id')
  @ApiOperation({ summary: '处理举报' })
  async updateReport(
    @Param('id') id: string,
    @Body() body: UpdateReportDto,
    @Req() req?: ReqWithUser,
  ) {
    const result = await this.adminService.updateReportStatus(
      id,
      body.status,
      body.resolution,
    );
    if (req) {
      this.log(
        req,
        'UPDATE_REPORT',
        'report',
        id,
        `举报状态变更为 ${body.status}`,
      );
    }
    return result;
  }

  @Post('reports/:id/ban')
  @ApiOperation({ summary: '处理举报并封禁用户' })
  async resolveWithBan(
    @Param('id') id: string,
    @Body() body: ResolveReportBanDto,
    @Req() req: ReqWithUser,
  ) {
    const result = await this.adminService.resolveReportWithBan(
      id,
      body.resolution,
    );
    this.log(req, 'REPORT_BAN', 'report', id, '举报处理并封禁用户');
    return result;
  }

  // ─── Conversations ───

  @Get('conversations')
  @ApiOperation({ summary: '对话列表' })
  getConversations(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.getConversations(page, pageSize, search, type);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: '对话消息详情' })
  getConversationMessages(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getConversationMessages(id, page, pageSize);
  }

  // ─── Analytics ───

  @Get('analytics')
  @ApiOperation({ summary: '数据分析' })
  getAnalytics(@Query('days') days?: number) {
    return this.adminService.getAnalytics(days || 30);
  }

  // ─── Personality ───

  @Get('personality-stats')
  @ApiOperation({ summary: '性格测试统计' })
  getPersonalityStats() {
    return this.adminService.getPersonalityStats();
  }

  // ─── System / Org ───

  @Get('system')
  @ApiOperation({ summary: '系统信息' })
  getSystemInfo() {
    return this.adminService.getSystemInfo();
  }

  @Get('admins')
  @ApiOperation({ summary: '管理员列表' })
  getAdminUsers() {
    return this.adminService.getAdminUsers();
  }

  @Post('admins')
  @ApiOperation({ summary: '创建管理员' })
  @Throttle({ default: ADMIN_THROTTLE.createAdmin })
  async createAdmin(@Body() body: CreateAdminDto, @Req() req: ReqWithUser) {
    const requesterId = this.requireAdminId(req);
    const result = await this.adminService.createAdminUser(
      body.email,
      body.password,
      body.nickname,
      requesterId,
    );
    this.log(
      req,
      'CREATE_ADMIN',
      'admin',
      result.id,
      `创建管理员 ${body.nickname}`,
    );
    return result;
  }

  // ─── Soul Sessions ───

  @Get('soul-sessions')
  @ApiOperation({ summary: '心灵解脱会话列表' })
  getSoulSessions(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.getSoulSessions(page, pageSize, status);
  }

  @Get('soul-sessions/:id/messages')
  @ApiOperation({ summary: '心灵解脱会话消息' })
  getSoulSessionMessages(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getSoulSessionMessages(id, page, pageSize);
  }

  @Post('soul-sessions/:id/take')
  @ApiOperation({ summary: '接管心灵解脱会话' })
  async takeSoulSession(@Param('id') id: string, @Req() req: ReqWithUser) {
    const result = await this.adminService.takeSoulSession(
      id,
      this.requireAdminId(req),
    );
    this.log(
      req,
      'TAKE_SOUL_SESSION',
      'soul_session',
      id,
      '人工接管心灵解脱会话',
    );
    return result;
  }

  @Post('soul-sessions/:id/close')
  @ApiOperation({ summary: '关闭心灵解脱会话' })
  async closeSoulSession(@Param('id') id: string, @Req() req: ReqWithUser) {
    const result = await this.adminService.closeSoulSession(id);
    this.log(req, 'CLOSE_SOUL_SESSION', 'soul_session', id, '关闭心灵解脱会话');
    return result;
  }

  @Post('soul-sessions/:id/messages')
  @ApiOperation({ summary: '发送管理员消息' })
  async sendSoulMessage(
    @Param('id') id: string,
    @Body() body: SendSoulMessageDto,
    @Req() req: ReqWithUser,
  ) {
    const adminId = this.requireAdminId(req);
    const result = await this.adminService.sendSoulMessage(
      id,
      adminId,
      body.content,
    );
    this.log(req, 'SEND_SOUL_MESSAGE', 'soul_session', id, '发送管理员回复');
    return result;
  }

  // ─── Operational Messages ───

  @Get('op-messages')
  @ApiOperation({ summary: '运营消息列表' })
  getOpMessages(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('category') category?: string,
  ) {
    return this.adminService.getOperationalMessages(page, pageSize, category);
  }

  @Post('op-messages')
  @ApiOperation({ summary: '创建运营消息' })
  async createOpMessage(
    @Body() body: CreateOpMessageDto,
    @Req() req: ReqWithUser,
  ) {
    const result = await this.adminService.createOperationalMessage(body);
    this.log(
      req,
      'CREATE_OP_MESSAGE',
      'op_message',
      result.id,
      `创建运营消息: ${body.title}`,
    );
    return result;
  }

  @Put('op-messages/:id')
  @ApiOperation({ summary: '更新运营消息' })
  async updateOpMessage(
    @Param('id') id: string,
    @Body() body: UpdateOpMessageDto,
    @Req() req: ReqWithUser,
  ) {
    const result = await this.adminService.updateOperationalMessage(id, body);
    this.log(req, 'UPDATE_OP_MESSAGE', 'op_message', id, '更新运营消息');
    return result;
  }

  @Delete('op-messages/:id')
  @ApiOperation({ summary: '删除运营消息' })
  async deleteOpMessage(@Param('id') id: string, @Req() req: ReqWithUser) {
    const result = await this.adminService.deleteOperationalMessage(id);
    this.log(req, 'DELETE_OP_MESSAGE', 'op_message', id, '删除运营消息');
    return result;
  }

  // ─── Admin Self-Management ───

  @Post('change-password')
  @ApiOperation({ summary: '修改管理员密码' })
  @Throttle({ default: ADMIN_THROTTLE.changePassword })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Req() req: ReqWithUser,
  ) {
    const adminId = this.requireAdminId(req);
    const result = await this.adminService.changeAdminPassword(
      adminId,
      body.currentPassword,
      body.newPassword,
    );
    this.log(req, 'CHANGE_PASSWORD', 'admin', adminId, '修改密码');
    return result;
  }

  @Delete('admins/:id')
  @ApiOperation({ summary: '删除管理员' })
  @Throttle({ default: ADMIN_THROTTLE.deleteAdmin })
  async deleteAdmin(@Param('id') id: string, @Req() req: ReqWithUser) {
    const requesterId = this.requireAdminId(req);
    const result = await this.adminService.deleteAdmin(id, requesterId);
    this.log(req, 'DELETE_ADMIN', 'admin', id, '撤销管理员权限');
    return result;
  }

  @Post('health-check')
  @ApiOperation({ summary: '服务健康检查代理' })
  checkHealth(@Body() body: HealthCheckDto) {
    return this.adminService.checkServiceHealth(body.serviceKey);
  }

  @Post('tools/repair-data')
  @ApiOperation({ summary: '修复用户历史数据（头像/积分）' })
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  async repairData(@Body() body: RepairDataDto, @Req() req: ReqWithUser) {
    const requesterId = this.requireAdminId(req);
    const result = await this.adminService.repairUserData(
      requesterId,
      body.scope || 'all',
      !!body.dryRun,
    );
    this.log(
      req,
      'REPAIR_USER_DATA',
      'system',
      undefined,
      `scope=${result.scope}, dryRun=${result.dryRun}, avatarFixed=${result.avatarFixed}, creditCreated=${result.creditScoreCreated}, creditLevelFixed=${result.creditLevelFixed}`,
    );
    return result;
  }

  @Get('tools/avatar-pool-config')
  @ApiOperation({ summary: '获取默认头像池配置' })
  getAvatarPoolConfig() {
    return this.adminService.getAvatarPoolSettings();
  }

  @Post('tools/avatar-pool-config')
  @ApiOperation({ summary: '更新默认头像池配置（运行时）' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async updateAvatarPoolConfig(
    @Body() body: UpdateAvatarPoolConfigDto,
    @Req() req: ReqWithUser,
  ) {
    const requesterId = this.requireAdminId(req);
    const result = await this.adminService.updateAvatarPoolSettings(requesterId, {
      perStyle: body.perStyle,
      reset: body.reset,
    });
    this.log(
      req,
      'UPDATE_AVATAR_POOL_CONFIG',
      'system',
      undefined,
      `perStyle=${result.perStyle}, source=${result.source}, reset=${!!body.reset}`,
    );
    return result;
  }

  @Get('tools/default-avatars')
  @ApiOperation({ summary: '获取默认头像池状态' })
  getDefaultAvatars() {
    return this.adminService.getDefaultAvatarPoolSettings();
  }

  @Post('tools/default-avatars/generate')
  @ApiOperation({ summary: '随机生成默认头像池' })
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  async generateDefaultAvatars(
    @Body() body: GenerateDefaultAvatarsDto,
    @Req() req: ReqWithUser,
  ) {
    const requesterId = this.requireAdminId(req);
    const count = body.count || 1000;
    const result = await this.adminService.generateDefaultAvatarPool(
      requesterId,
      count,
    );
    this.log(
      req,
      'GENERATE_DEFAULT_AVATARS',
      'system',
      undefined,
      `count=${count}`,
    );
    return result;
  }

  @Get('export/users')
  @ApiOperation({ summary: '导出全部用户' })
  exportUsers() {
    return this.adminService.exportUsers();
  }

  // ─── Audit Log ───

  @Get('audit-logs')
  @ApiOperation({ summary: '审计日志' })
  getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.adminService.getAuditLogs(
      query.page,
      query.pageSize,
      query.action,
      query.adminSearch,
      query.startDate,
      query.endDate,
    );
  }

  @Get('audit-logs/export')
  @ApiOperation({ summary: '导出审计日志（按筛选全量）' })
  exportAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.adminService.exportAuditLogs(
      query.action,
      query.adminSearch,
      query.startDate,
      query.endDate,
    );
  }
}
