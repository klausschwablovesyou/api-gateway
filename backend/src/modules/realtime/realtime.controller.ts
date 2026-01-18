import { WebSocketController, OnWebSocketMessage, WebSocket as WsParam, Body } from '@danet/core';
import { RealtimeService } from './realtime.service.ts';
import { JwtService } from '../../shared/services/jwt.service.ts';
import { RealtimeTopic } from '@shared/types/realtime-topic';

@WebSocketController('realtime')
export class RealtimeController {
  constructor(
    private readonly _realtimeService: RealtimeService,
    private readonly _jwtService: JwtService
  ) {}

  @OnWebSocketMessage(RealtimeTopic.Subscribe)
  public async subscribe(@WsParam socket: WebSocket, @Body() payload: { token?: string }): Promise<void> {
    if (!payload?.token) {
      console.log('[Realtime] Client tried to subscribe without token');
      socket.close(4001, 'Token required');
      return;
    }

    const userPayload = await this._jwtService.extractUserFromToken(payload.token);
    if (!userPayload) {
      console.log('[Realtime] Client tried to subscribe with invalid token');
      socket.close(4002, 'Invalid token');
      return;
    }

    this._realtimeService.addClient(userPayload.userId, userPayload.userRole, socket);
  }
}
