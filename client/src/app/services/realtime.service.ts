import { Injectable, signal } from '@angular/core';
import { RealtimeTopic } from '@shared/types/realtime-topic';

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private _socket: WebSocket | null = null;
  private _listeners: Map<RealtimeTopic, Set<(data: any) => void>> = new Map();
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  public isConnected = signal(false);

  public connect(): void {
    console.log('[Realtime] connect() called, current state:', this._socket?.readyState);

    if (this._socket?.readyState === WebSocket.OPEN) {
      console.log('[Realtime] Already connected, skipping');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const realtimeUrl = `${protocol}//${window.location.host}/realtime`;
    console.log('[Realtime] Connecting to:', realtimeUrl);

    this._socket = new WebSocket(realtimeUrl);

    this._socket.onopen = () => {
      console.log('[Realtime] Connected, sending subscribe message');
      const token = localStorage.getItem('authToken');
      this._socket?.send(JSON.stringify({ topic: RealtimeTopic.Subscribe, data: { token } }));
      this.isConnected.set(true);
    };

    this._socket.onclose = (closeEvent) => {
      console.log('[Realtime] Disconnected');
      this.isConnected.set(false);

      // The server rejected the token (4001: missing, 4002: invalid or expired); retrying cannot succeed.
      if (closeEvent.code !== 4001 && closeEvent.code !== 4002) {
        this.reconnect();
      }
    };

    this._socket.onerror = (error) => {
      console.error('[Realtime] Error:', error);
    };

    this._socket.onmessage = (wsEvent) => {
      try {
        const message = JSON.parse(wsEvent.data);
        this.handleMessage(message.topic, message.data);
      } catch (error) {
        console.error('[Realtime] Failed to parse message:', error);
      }
    };
  }

  public disconnect(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this._socket) {
      this._socket.onclose = null;
      this._socket.close();
      this._socket = null;
    }

    this.isConnected.set(false);
  }

  public on(topic: RealtimeTopic, callback: (data: any) => void): () => void {
    if (!this._listeners.has(topic)) {
      this._listeners.set(topic, new Set());
    }

    this._listeners.get(topic)!.add(callback);

    return () => {
      this._listeners.get(topic)?.delete(callback);
    };
  }

  private handleMessage(topic: RealtimeTopic, data: any): void {
    const callbacks = this._listeners.get(topic);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  private reconnect(): void {
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      console.log('[Realtime] Reconnecting...');
      this.connect();
    }, 3000);
  }
}
