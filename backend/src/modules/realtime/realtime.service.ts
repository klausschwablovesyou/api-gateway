import { Injectable } from '@danet/core';
import { ClientInfo } from '@shared/types/client-info';
import { RealtimeTopic } from '@shared/types/realtime-topic';
import { UserRole } from '@shared/types/user-role';

// Estimated memory per component (in bytes)
const ESTIMATED_MEMORY_PER_TELEGRAM_CLIENT = 5 * 1024 * 1024; // 5MB per active Telegram client
const ESTIMATED_MEMORY_PER_REALTIME_CLIENT = 50 * 1024; // 50KB per WebSocket connection
const ESTIMATED_MEMORY_PER_DB_CONNECTION = 2 * 1024 * 1024; // 2MB per database connection

@Injectable()
export class RealtimeService {
  private _clients: Map<string, Set<ClientInfo>> = new Map();
  private _memoryInterval: number | null = null;
  private _telegramStatsProvider: (() => { totalClients: number; activeClients: number }) | null = null;
  private _dbConnectionCount: number = 5; // Default pool size

  constructor() {
  }

  public setTelegramStatsProvider(provider: () => { totalClients: number; activeClients: number }): void {
    this._telegramStatsProvider = provider;
  }

  public setDbConnectionCount(count: number): void {
    this._dbConnectionCount = count;
  }

  public addClient(userId: string, userRole: UserRole, client: WebSocket): void {
    if (!this._clients.has(userId)) {
      this._clients.set(userId, new Set());
    }
    const clientInfo: ClientInfo = { socket: client, userRole };
    this._clients.get(userId)!.add(clientInfo);
    console.log(`[Realtime] Client connected: ${userId} (${userRole}). Total clients: ${this._clients.get(userId)!.size}`);

    client.onclose = () => {
      this._clients.get(userId)?.delete(clientInfo);
      if (this._clients.get(userId)?.size === 0) {
        this._clients.delete(userId);
      }
      console.log(`[Realtime] Client disconnected: ${userId}`);
    };
  }

  private _startMemoryBroadcast(): void {
    this._memoryInterval = setInterval(() => {
      const processMemory = Deno.memoryUsage();
      const realtimeClientCount = this.getClientCount();
      const telegramStats = this._telegramStatsProvider?.() ?? { totalClients: 0, activeClients: 0 };

      const memoryData = {
        backend: {
          heapUsed: processMemory.heapUsed,
          heapTotal: processMemory.heapTotal,
          rss: processMemory.rss,
          external: processMemory.external
        },
        telegram: {
          count: telegramStats.activeClients,
          estimated: telegramStats.activeClients * ESTIMATED_MEMORY_PER_TELEGRAM_CLIENT
        },
        realtime: {
          count: realtimeClientCount,
          estimated: realtimeClientCount * ESTIMATED_MEMORY_PER_REALTIME_CLIENT
        },
        database: {
          count: this._dbConnectionCount,
          estimated: this._dbConnectionCount * ESTIMATED_MEMORY_PER_DB_CONNECTION
        }
      };

      this.notifyByRole(UserRole.SuperAdmin, RealtimeTopic.MemoryUsage, memoryData);
    }, 5000);
  }

  public notifyClients(userId: string, topic: RealtimeTopic, data: any = null): void {
    const userClients = this._clients.get(userId);
    if (!userClients) {
      console.log(`[Realtime] No clients found for user ${userId}`);
      return;
    }

    const message = JSON.stringify({ topic, data });
    console.log(`[Realtime] Sending to user ${userId}, topic: ${topic}, clients: ${userClients.size}`);

    for (const clientInfo of userClients) {
      if (clientInfo.socket.readyState === WebSocket.OPEN) {
        clientInfo.socket.send(message);
      }
    }
  }

  public notifyByRole(role: UserRole, topic: RealtimeTopic, data: any = null): void {
    const message = JSON.stringify({ topic, data });
    let totalClients = 0;

    for (const clients of this._clients.values()) {
      for (const clientInfo of clients) {
        if (clientInfo.userRole === role && clientInfo.socket.readyState === WebSocket.OPEN) {
          clientInfo.socket.send(message);
          totalClients++;
        }
      }
    }
  }

  public broadcast(topic: RealtimeTopic, data: any = null): void {
    const message = JSON.stringify({ topic, data });
    let totalClients = 0;

    for (const clients of this._clients.values()) {
      for (const clientInfo of clients) {
        if (clientInfo.socket.readyState === WebSocket.OPEN) {
          clientInfo.socket.send(message);
          totalClients++;
        }
      }
    }
    console.log(`[Realtime] Broadcast topic: ${topic}, sent to ${totalClients} clients`);
  }

  public getClientCount(): number {
    let count = 0;
    for (const clients of this._clients.values()) {
      count += clients.size;
    }
    return count;
  }
}
