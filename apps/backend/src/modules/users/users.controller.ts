import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  UpdateProfileDto,
  UpdatePsychProfileDto,
} from './dto/update-profile.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '获取个人完整资料' })
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Get('me/stats')
  @ApiOperation({ summary: '获取首页实时统计' })
  getLiveStats(@CurrentUser('id') userId: string) {
    return this.usersService.getLiveStats(userId);
  }

  @Get('me/unread')
  @ApiOperation({ summary: '获取未读消息数' })
  getUnreadCounts(@CurrentUser('id') userId: string) {
    return this.usersService.getUnreadCounts(userId);
  }

  @Get('me/credit-history')
  @ApiOperation({ summary: '获取信用记录' })
  getCreditHistory(@CurrentUser('id') userId: string) {
    return this.usersService.getCreditHistory(userId);
  }

  @Post('me/checkin')
  @ApiOperation({ summary: '每日签到' })
  dailyCheckin(@CurrentUser('id') userId: string) {
    return this.usersService.dailyCheckin(userId);
  }

  @Get('op-messages')
  @ApiOperation({ summary: '获取运营消息' })
  getOpMessages() {
    return this.usersService.getOperationalMessages();
  }

  @Get('personality-questions')
  @ApiOperation({ summary: '获取性格测试题目' })
  getPersonalityQuestions() {
    return this.getPersonalityQuestionsData();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取用户资料' })
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  @Put('me')
  @ApiOperation({ summary: '更新个人资料' })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Put('me/psychology')
  @ApiOperation({ summary: '更新心理档案' })
  updatePsychProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePsychProfileDto,
  ) {
    return this.usersService.updatePsychProfile(userId, dto);
  }

  @Post('me/personality-test')
  @ApiOperation({ summary: '提交性格测试' })
  submitPersonalityTest(
    @CurrentUser('id') userId: string,
    @Body() answers: Record<string, any>,
  ) {
    return this.usersService.submitPersonalityTest(userId, answers);
  }

  @Post('me/change-password')
  @ApiOperation({ summary: '修改密码' })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(
      userId,
      body.oldPassword,
      body.newPassword,
    );
  }

  @Post('me/report')
  @ApiOperation({ summary: '举报用户' })
  reportUser(
    @CurrentUser('id') userId: string,
    @Body() body: { reportedId: string; reason: string; detail?: string },
  ) {
    return this.usersService.createReport(
      userId,
      body.reportedId,
      body.reason,
      body.detail,
    );
  }

  private getPersonalityQuestionsData() {
    return {
      total: 20,
      sections: [
        {
          id: 'attachment',
          title: '依恋模式',
          subtitle: '了解你在亲密关系中的安全感',
          questions: [
            {
              id: 'q1',
              text: '当伴侣没有及时回复消息时，我会感到不安',
              dimension: 'anxiety',
            },
            { id: 'q2', text: '我经常担心对方会离开我', dimension: 'anxiety' },
            {
              id: 'q3',
              text: '我需要对方频繁的关注和确认',
              dimension: 'anxiety',
            },
            {
              id: 'q4',
              text: '独处时我会不自觉地想对方在做什么',
              dimension: 'anxiety',
            },
            {
              id: 'q5',
              text: '当关系变得亲密时，我会想要拉开一些距离',
              dimension: 'avoidance',
            },
            {
              id: 'q6',
              text: '我不太擅长表达自己的感情',
              dimension: 'avoidance',
            },
            {
              id: 'q7',
              text: '我更喜欢独立处理自己的问题',
              dimension: 'avoidance',
            },
            {
              id: 'q8',
              text: '过度的亲密会让我感到不自在',
              dimension: 'avoidance',
            },
          ],
        },
        {
          id: 'communication',
          title: '沟通风格',
          subtitle: '发现你的交流方式偏好',
          questions: [
            {
              id: 'q9',
              text: '我倾向于直接说出自己的想法和需求',
              dimension: 'directness',
            },
            {
              id: 'q10',
              text: '我不喜欢拐弯抹角，有话直说',
              dimension: 'directness',
            },
            {
              id: 'q11',
              text: '和人交流时我更关注情感氛围',
              dimension: 'emotionality',
            },
            {
              id: 'q12',
              text: '我很容易被对方的语气和表情影响',
              dimension: 'emotionality',
            },
            {
              id: 'q13',
              text: '做决定时我更看重逻辑和数据',
              dimension: 'analyticity',
            },
            {
              id: 'q14',
              text: '我习惯分析问题的各个方面后再表态',
              dimension: 'analyticity',
            },
          ],
        },
        {
          id: 'traits',
          title: '性格特质',
          subtitle: '探索你的性格底色',
          questions: [
            {
              id: 'q15',
              text: '我喜欢尝试新事物和新体验',
              dimension: 'openness',
            },
            {
              id: 'q16',
              text: '我享受独处的时光，这让我充电',
              dimension: 'introversion',
            },
            {
              id: 'q17',
              text: '我容易感受到他人的情绪变化',
              dimension: 'empathy',
            },
            {
              id: 'q18',
              text: '我喜欢有计划、有条理地做事',
              dimension: 'conscientiousness',
            },
            {
              id: 'q19',
              text: '在社交场合我感到自在和享受',
              dimension: 'extraversion',
            },
            {
              id: 'q20',
              text: '比起认识更多人，我更重视深度关系',
              dimension: 'depth',
            },
          ],
        },
      ],
      scale: {
        min: 1,
        max: 5,
        labels: ['完全不符合', '比较不符合', '一般', '比较符合', '完全符合'],
      },
    };
  }
}
