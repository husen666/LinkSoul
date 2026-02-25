import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from '../chat.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSocketCount = new Map<string, number>();

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {}

  private getUserId(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as string | undefined;
    const queryToken = client.handshake.query.token as string | undefined;
    const rawAuthHeader = client.handshake.headers.authorization;
    const headerToken = rawAuthHeader?.startsWith('Bearer ')
      ? rawAuthHeader.slice(7)
      : undefined;
    const token = authToken || queryToken || headerToken;
    if (!token) return null;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      return payload?.sub || null;
    } catch {
      return null;
    }
  }

  async handleConnection(client: Socket) {
    const userId = this.getUserId(client);
    if (!userId) return client.disconnect(true);
    client.data.userId = userId;
    client.join(`user:${userId}`);
    const currentCount = this.userSocketCount.get(userId) || 0;
    const nextCount = currentCount + 1;
    this.userSocketCount.set(userId, nextCount);
    if (nextCount === 1) {
      await this.chatService.setOnlineStatus(userId, true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = (client.data.userId as string | undefined) || this.getUserId(client);
    if (userId) {
      const currentCount = this.userSocketCount.get(userId) || 0;
      const nextCount = Math.max(0, currentCount - 1);
      if (nextCount === 0) {
        this.userSocketCount.delete(userId);
        await this.chatService.setOnlineStatus(userId, false);
      } else {
        this.userSocketCount.set(userId, nextCount);
      }
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;
    await this.chatService.assertConversationMember(
      data.conversationId,
      userId,
    );
    client.join(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
      type?: string;
      mediaUrl?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;
    const convo = await this.chatService.assertConversationMember(
      data.conversationId,
      userId,
    );

    const message = await this.chatService.sendMessage(
      data.conversationId,
      userId,
      data.content,
      data.type,
      false,
      {
        mediaUrl: data.mediaUrl,
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      },
    );

    const participantIds = [convo.match.userAId, convo.match.userBId];
    for (const participantId of participantIds) {
      this.server.to(`user:${participantId}`).emit('newMessage', message);
    }

    return message;
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;
    await this.chatService.assertConversationMember(
      data.conversationId,
      userId,
    );
    client.to(`conversation:${data.conversationId}`).emit('userTyping', {
      userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;
    const convo = await this.chatService.assertConversationMember(
      data.conversationId,
      userId,
    );
    await this.chatService.markAsRead(data.conversationId, userId);
    const payload = {
      userId,
      conversationId: data.conversationId,
    };
    this.server
      .to(`user:${convo.match.userAId}`)
      .emit('messagesRead', payload);
    this.server
      .to(`user:${convo.match.userBId}`)
      .emit('messagesRead', payload);
  }
}
