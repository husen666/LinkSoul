import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FunService } from './fun.service';

@ApiTags('Fun')
@Controller('fun')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FunController {
  constructor(private funService: FunService) {}

  @Get('blindbox/open')
  @ApiOperation({ summary: '打开今日盲盒（真实后端结果）' })
  openBlindbox(@CurrentUser('id') userId: string) {
    return this.funService.openBlindbox(userId);
  }

  @Get('compat-pk/:matchId/start')
  @ApiOperation({ summary: '开始默契 PK（返回问题与对手答案）' })
  startCompatPk(
    @CurrentUser('id') userId: string,
    @Param('matchId') matchId: string,
  ) {
    return this.funService.startCompatPk(userId, matchId);
  }

  @Post('compat-pk/:matchId/result')
  @ApiOperation({ summary: '计算默契 PK 结果' })
  calcCompatPk(
    @CurrentUser('id') userId: string,
    @Param('matchId') matchId: string,
    @Body('answers') answers: string[],
  ) {
    return this.funService.calcCompatPk(userId, matchId, answers || []);
  }

  @Get('fortune/today')
  @ApiOperation({ summary: '获取今日运势（后端生成）' })
  getTodayFortune(@CurrentUser('id') userId: string) {
    return this.funService.getTodayFortune(userId);
  }

  @Post('soul-qa/evaluate')
  @ApiOperation({ summary: '计算灵魂问答结果（后端）' })
  evaluateSoulQa(@Body('scores') scores: number[][]) {
    return this.funService.evaluateSoulQa(scores || []);
  }
}
