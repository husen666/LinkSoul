import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Matches')
@Controller('matches')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Get('daily')
  @ApiOperation({ summary: '获取每日推荐' })
  getDailyRecommendations(@CurrentUser('id') userId: string) {
    return this.matchesService.getDailyRecommendations(userId);
  }

  @Get()
  @ApiOperation({ summary: '获取所有匹配' })
  getMyMatches(@CurrentUser('id') userId: string) {
    return this.matchesService.getMyMatches(userId);
  }

  @Get(':targetUserId/status')
  @ApiOperation({ summary: '获取与目标用户的互动状态' })
  getInteractionStatus(
    @CurrentUser('id') userId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.matchesService.getInteractionStatus(userId, targetUserId);
  }

  @Post(':targetUserId/accept')
  @ApiOperation({ summary: '接受匹配' })
  acceptMatch(
    @CurrentUser('id') userId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.matchesService.acceptMatch(userId, targetUserId);
  }

  @Post(':targetUserId/super-accept')
  @ApiOperation({ summary: '超级喜欢（共振）' })
  superAcceptMatch(
    @CurrentUser('id') userId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.matchesService.acceptMatch(userId, targetUserId, true);
  }

  @Post(':targetUserId/reject')
  @ApiOperation({ summary: '拒绝匹配' })
  rejectMatch(
    @CurrentUser('id') userId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.matchesService.rejectMatch(userId, targetUserId);
  }

  @Get(':matchId/analysis')
  @ApiOperation({ summary: '获取匹配关系分析' })
  getMatchAnalysis(
    @CurrentUser('id') userId: string,
    @Param('matchId') matchId: string,
  ) {
    return this.matchesService.getMatchAnalysis(matchId, userId);
  }
}
