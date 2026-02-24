import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';

function decodeUploadFileName(name?: string) {
  const raw = (name || '').trim();
  if (!raw) return 'file';
  if (/^[\x00-\x7F]+$/.test(raw)) return raw;

  const fromUri = /%[0-9A-Fa-f]{2}/.test(raw)
    ? (() => {
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      })()
    : raw;

  const fromLatin1 = Buffer.from(fromUri, 'latin1').toString('utf8');
  const score = (s: string) => {
    const cjk = (s.match(/[\u3400-\u9fff]/g) || []).length;
    const bad = (s.match(/�/g) || []).length;
    const mojibake = (s.match(/[ÃÂæåçð]/g) || []).length;
    return cjk * 3 - bad * 4 - mojibake * 2;
  };

  return score(fromLatin1) > score(fromUri) ? fromLatin1 : fromUri;
}

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations' })
  getConversations(@CurrentUser('id') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @Post('conversations/:matchId')
  @ApiOperation({ summary: 'Get or create a conversation for a match' })
  getOrCreateConversation(
    @Param('matchId') matchId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.getOrCreateConversation(matchId, userId);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(conversationId, userId, cursor, limit);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message (REST fallback)' })
  sendMessage(@CurrentUser('id') userId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(
      dto.conversationId,
      userId,
      dto.content,
      dto.type,
      false,
      {
        mediaUrl: dto.mediaUrl,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
      },
    );
  }

  @Get('play-modes')
  @ApiOperation({ summary: '获取玩法热门榜与个性化推荐' })
  getPlayModes(
    @CurrentUser('id') userId: string,
    @Query('conversationId') conversationId?: string,
  ) {
    return this.chatService.getPlayLabModes(userId, conversationId);
  }

  @Post('play-modes/track')
  @ApiOperation({ summary: '记录玩法事件埋点' })
  trackPlayMode(
    @CurrentUser('id') userId: string,
    @Body()
    dto: {
      modeKey: string;
      event: 'open' | 'run' | 'success' | 'fail';
      conversationId?: string;
    },
  ) {
    return this.chatService.trackPlayModeEvent(
      userId,
      dto.modeKey,
      dto.event,
      dto.conversationId,
    );
  }

  @Post('upload')
  @ApiOperation({ summary: '上传聊天媒体文件' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/chat',
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const normalized = decodeUploadFileName(file.originalname);
          file.originalname = normalized;
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(normalized)}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        const ok =
          file.mimetype.startsWith('image/') ||
          file.mimetype.startsWith('video/') ||
          file.mimetype.startsWith('audio/') ||
          file.mimetype === 'application/pdf' ||
          file.mimetype.includes('application') ||
          file.mimetype.includes('text/');
        cb(null, ok);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('文件不能为空');
    const fileName = decodeUploadFileName(file.originalname);
    return {
      url: `/uploads/chat/${file.filename}`,
      fileName,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: '删除自己发送的消息' })
  deleteMessage(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.chatService.deleteMessage(id, userId);
  }
}
