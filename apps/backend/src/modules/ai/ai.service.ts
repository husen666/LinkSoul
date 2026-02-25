import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiServiceUrl: string;

  constructor(private configService: ConfigService) {
    this.aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  /**
   * Chat Agent: 情绪识别→上下文→策略→生成→安全过滤
   */
  async getChatSuggestions(
    conversationContext: string,
    userProfile: any,
    relationshipStage: string,
  ) {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/v1/chat/suggestions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: conversationContext,
            user_profile: userProfile,
            relationship_stage: relationshipStage,
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(`Chat Agent returned ${response.status}`);
        return this.getFallbackChatResult();
      }

      return response.json();
    } catch {
      this.logger.warn('AI service unavailable, using fallback');
      return this.getFallbackChatResult();
    }
  }

  async getPlayPlans(
    mode: string,
    instruction: string,
    relationshipStage: string,
    userProfile: any,
  ) {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/play/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          instruction,
          relationship_stage: relationshipStage,
          user_profile: userProfile || {},
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Play planner returned ${response.status}`);
        return this.getFallbackPlayPlans(mode);
      }

      return response.json();
    } catch {
      this.logger.warn('Play planner unavailable, using fallback');
      return this.getFallbackPlayPlans(mode);
    }
  }

  /**
   * Match Agent: 画像分析→兼容性评估(R1)→匹配理由
   */
  async analyzeMatch(userAProfile: any, userBProfile: any) {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/v1/match/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_a_profile: userAProfile,
            user_b_profile: userBProfile,
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(`Match Agent returned ${response.status}`);
        return { overall_score: 60, match_reason: '兼容性分析暂时不可用' };
      }

      return response.json();
    } catch {
      this.logger.warn('Match Agent unavailable');
      return { overall_score: 60, match_reason: '兼容性分析暂时不可用' };
    }
  }

  /**
   * Relation Agent: 阶段判断(R1)→进展评估→建议生成
   */
  async analyzeRelation(
    userProfile: any,
    partnerProfile: any,
    currentStage: string,
    interactionHistory: string,
  ) {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/v1/relation/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_profile: userProfile,
            partner_profile: partnerProfile,
            current_stage: currentStage,
            interaction_history: interactionHistory,
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(`Relation Agent returned ${response.status}`);
        return this.getFallbackRelationResult(currentStage);
      }

      return response.json();
    } catch {
      this.logger.warn('Relation Agent unavailable');
      return this.getFallbackRelationResult(currentStage);
    }
  }

  async analyzeEmotion(text: string) {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/v1/analysis/emotion`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        },
      );

      if (!response.ok) return { emotion: 'neutral', confidence: 0.5 };
      return response.json();
    } catch {
      return { emotion: 'neutral', confidence: 0.5 };
    }
  }

  async analyzeScreenshot(imageUrl: string) {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/v1/analysis/screenshot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl }),
        },
      );

      if (!response.ok) return { analysis: '暂时无法分析截图' };
      return response.json();
    } catch {
      return { analysis: 'AI 服务暂时不可用' };
    }
  }

  private getFallbackChatResult() {
    return {
      suggestions: [
        '今天过得怎么样？有什么开心的事想分享吗？',
        '最近有没有看什么好看的电影或者书？',
        '周末有什么计划吗？',
      ],
      emotion: 'neutral',
      emotion_confidence: 0.5,
      strategy: 'fallback',
    };
  }

  private getFallbackRelationResult(currentStage: string) {
    return {
      recommended_stage: currentStage,
      progress_score: 50,
      advice: ['保持真诚的沟通', '多了解对方的兴趣爱好', '注意倾听对方的感受'],
      stage_report: '暂时无法生成详细报告，请稍后重试。',
    };
  }

  private getFallbackPlayPlans(mode: string) {
    if (mode === 'date-planner') {
      return {
        plans: [
          '方案A：咖啡破冰 + 20分钟散步，预算 50-120，开场问最近一件小开心。',
          '方案B：逛展 + 晚餐复盘，预算 150-350，围绕“最有共鸣的一件作品”展开。',
          '方案C：雨天桌游/手作，预算 80-220，先轻任务再聊彼此近况。',
        ],
      };
    }
    return {
      plans: [
        '共创A：各提 2 个点子，合并为 1 个本周可执行计划。',
        '共创B：双人故事接龙，每人 2 句，最后整合成完整版本。',
        '共创C：关系升级卡（期待/边界/行动）并约定一周后复盘。',
      ],
    };
  }
}
