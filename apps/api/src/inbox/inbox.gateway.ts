import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  namespace: '/inbox',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class InboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InboxGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: No auth token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // Attach user info to socket
      (client as any).userId = payload.sub;
      (client as any).tenantId = payload.tenantId;

      // Auto-join tenant room
      const room = `tenant:${payload.tenantId}`;
      client.join(room);

      this.logger.log(
        `Client ${client.id} connected to room ${room} (user: ${payload.sub})`,
      );

      // Send confirmation
      client.emit('connected', {
        message: 'Connected to inbox',
        room,
      });
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} rejected: Invalid token - ${error.message}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Handle explicit room subscription (for multi-tenant switching)
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    const tenantId = (client as any).tenantId;

    // Only allow subscribing to the tenant the user belongs to
    if (data.tenantId && data.tenantId !== tenantId) {
      client.emit('error', { message: 'Unauthorized tenant subscription' });
      return;
    }

    const room = `tenant:${tenantId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to ${room}`);
    return { event: 'subscribed', data: { room } };
  }

  /**
   * Handle mark as read in real-time
   */
  @SubscribeMessage('markAsRead')
  handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interactionId: string },
  ) {
    const tenantId = (client as any).tenantId;
    const room = `tenant:${tenantId}`;

    // Broadcast to all clients in the tenant room
    client.to(room).emit('interaction:read', {
      interactionId: data.interactionId,
    });
  }

  /**
   * Handle typing indicator for reply
   */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interactionId: string; isTyping: boolean },
  ) {
    const tenantId = (client as any).tenantId;
    const room = `tenant:${tenantId}`;

    client.to(room).emit('interaction:typing', {
      interactionId: data.interactionId,
      userId: (client as any).userId,
      isTyping: data.isTyping,
    });
  }

  // ==========================================
  // Server-side emitters (called by services)
  // ==========================================

  /**
   * Broadcast a new interaction to all clients in a tenant room
   */
  sendNewInteraction(tenantId: string, interaction: any) {
    const room = `tenant:${tenantId}`;
    this.server.to(room).emit('interaction:new', interaction);
    this.logger.log(
      `Emitted interaction:new to ${room} (id: ${interaction.id})`,
    );
  }

  /**
   * Broadcast an interaction update (replied, hidden, deleted)
   */
  sendInteractionUpdate(
    tenantId: string,
    interactionId: string,
    update: Record<string, any>,
  ) {
    const room = `tenant:${tenantId}`;
    this.server.to(room).emit('interaction:updated', {
      interactionId,
      ...update,
    });
  }

  /**
   * Get count of connected clients in a tenant room
   */
  async getConnectedCount(tenantId: string): Promise<number> {
    const room = `tenant:${tenantId}`;
    const sockets = await this.server.in(room).fetchSockets();
    return sockets.length;
  }
}
