import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Feed')
@Controller('feed')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FeedController {
  constructor(private feedService: FeedService) {}

  @Post()
  @ApiOperation({ summary: '发布动态' })
  createPost(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      content: string;
      mood?: string;
      visibility?: string;
      imageUrl?: string;
      mediaList?: Array<{ type: 'image' | 'video'; url: string }>;
      music?: string;
      location?: string;
      link?: string;
      pollOptions?: string[];
    },
  ) {
    return this.feedService.createPost(userId, body);
  }

  @Get()
  @ApiOperation({ summary: '获取动态流' })
  getFeed(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('mode') mode?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.feedService.getFeed(
      userId,
      Number(page) || 1,
      Number(pageSize) || 20,
      mode,
      cursor,
    );
  }

  @Get('mine')
  @ApiOperation({ summary: '获取我的动态' })
  getMyDynamics(@CurrentUser('id') userId: string) {
    return this.feedService.getMyDynamics(userId);
  }

  @Post(':id/like')
  @ApiOperation({ summary: '点赞/取消点赞' })
  toggleLike(
    @Param('id') dynamicId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.feedService.toggleLike(dynamicId, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除动态' })
  deletePost(
    @Param('id') dynamicId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.feedService.deletePost(dynamicId, userId);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: '获取动态评论' })
  getComments(
    @Param('id') dynamicId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.feedService.getComments(
      dynamicId,
      userId,
      Number(page) || 1,
      Number(pageSize) || 100,
    );
  }

  @Get(':id/comments/page')
  @ApiOperation({ summary: '获取动态评论（分页对象）' })
  getCommentsPage(
    @Param('id') dynamicId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.feedService.getCommentsPage(
      dynamicId,
      userId,
      Number(page) || 1,
      Number(pageSize) || 20,
    );
  }

  @Post(':id/comments')
  @ApiOperation({ summary: '发表评论' })
  addComment(
    @Param('id') dynamicId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { content: string },
  ) {
    return this.feedService.addComment(dynamicId, userId, body.content);
  }

  @Post(':id/poll-vote')
  @ApiOperation({ summary: '动态投票' })
  votePoll(
    @Param('id') dynamicId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { optionId: string },
  ) {
    return this.feedService.votePoll(dynamicId, userId, body.optionId);
  }
}
