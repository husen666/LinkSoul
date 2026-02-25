import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('chat-suggestions')
  @ApiOperation({
    summary: 'Chat Agent — 情绪识别→策略选择→回复生成→安全过滤',
  })
  getChatSuggestions(
    @Body()
    body: {
      context: string;
      userProfile?: any;
      relationshipStage?: string;
    },
  ) {
    return this.aiService.getChatSuggestions(
      body.context,
      body.userProfile || {},
      body.relationshipStage || 'INITIAL',
    );
  }

  @Post('play-plans')
  @ApiOperation({
    summary: 'Play Planner — 按关系阶段生成可执行玩法方案',
  })
  getPlayPlans(
    @Body()
    body: {
      mode: string;
      instruction: string;
      userProfile?: any;
      relationshipStage?: string;
    },
  ) {
    return this.aiService.getPlayPlans(
      body.mode,
      body.instruction,
      body.relationshipStage || 'INITIAL',
      body.userProfile || {},
    );
  }

  @Post('match-analysis')
  @ApiOperation({
    summary: 'Match Agent — 画像分析→兼容性评估(R1)→匹配理由',
  })
  analyzeMatch(
    @Body()
    body: {
      userAProfile: any;
      userBProfile: any;
    },
  ) {
    return this.aiService.analyzeMatch(body.userAProfile, body.userBProfile);
  }

  @Post('relation-analysis')
  @ApiOperation({
    summary: 'Relation Agent — 阶段判断(R1)→进展评估→建议生成',
  })
  analyzeRelation(
    @Body()
    body: {
      userProfile: any;
      partnerProfile: any;
      currentStage?: string;
      interactionHistory?: string;
    },
  ) {
    return this.aiService.analyzeRelation(
      body.userProfile,
      body.partnerProfile,
      body.currentStage || 'INITIAL',
      body.interactionHistory || '',
    );
  }

  @Post('analyze-emotion')
  @ApiOperation({ summary: 'DeepSeek V3 情绪分析' })
  analyzeEmotion(@Body() body: { text: string }) {
    return this.aiService.analyzeEmotion(body.text);
  }

  @Post('analyze-screenshot')
  @ApiOperation({ summary: 'DeepSeek V3 聊天截图分析' })
  analyzeScreenshot(@Body() body: { imageUrl: string }) {
    return this.aiService.analyzeScreenshot(body.imageUrl);
  }
}
