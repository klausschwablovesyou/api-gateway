import { RealtimeService } from './realtime.service';
import { RealtimeTopic } from '@shared/types/realtime-topic';

class FakeWebSocket {
  public static readonly OPEN = 1;
  public static instances: FakeWebSocket[] = [];

  public readyState = 0;
  public sent: string[] = [];
  public onopen: (() => void) | null = null;
  public onclose: ((event: { code: number }) => void) | null = null;
  public onerror: ((error: unknown) => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;

  public constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  public send(message: string): void {
    this.sent.push(message);
  }

  public close(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }

  public open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  public receive(data: string): void {
    this.onmessage?.({ data });
  }
}

describe('RealtimeService', () => {
  const originalWebSocket = globalThis.WebSocket;
  let service: RealtimeService;

  const socket = (index = 0) => FakeWebSocket.instances[index];

  beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
    jasmine.clock().install();
    spyOn(console, 'log');
    spyOn(console, 'error');
    localStorage.setItem('authToken', 'token-1');
    service = new RealtimeService();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    globalThis.WebSocket = originalWebSocket;
    localStorage.removeItem('authToken');
  });

  describe('connect', () => {
    it('should open a socket on the current host', () => {
      service.connect();

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      expect(socket().url).toBe(`${protocol}//${window.location.host}/realtime`);
    });

    it('should not be connected until the socket opens', () => {
      service.connect();

      expect(service.isConnected()).toBeFalse();
    });

    it('should subscribe with the token when the socket opens', () => {
      service.connect();
      socket().open();

      expect(service.isConnected()).toBeTrue();
      expect(JSON.parse(socket().sent[0])).toEqual({ topic: RealtimeTopic.Subscribe, data: { token: 'token-1' } });
    });

    it('should not open a second socket while connected', () => {
      service.connect();
      socket().open();

      service.connect();

      expect(FakeWebSocket.instances.length).toBe(1);
    });
  });

  describe('reconnect', () => {
    it('should reconnect 3 seconds after the connection drops', () => {
      service.connect();
      socket().open();

      socket().close();
      expect(service.isConnected()).toBeFalse();

      jasmine.clock().tick(2999);
      expect(FakeWebSocket.instances.length).toBe(1);

      jasmine.clock().tick(1);
      expect(FakeWebSocket.instances.length).toBe(2);
    });

    for (const code of [4001, 4002]) {
      it(`should not reconnect when the server rejects the token with ${code}`, () => {
        service.connect();
        socket().open();

        socket().close(code);
        jasmine.clock().tick(3000);

        expect(service.isConnected()).toBeFalse();
        expect(FakeWebSocket.instances.length).toBe(1);
      });
    }
  });

  describe('disconnect', () => {
    it('should close the socket', () => {
      service.connect();
      socket().open();

      service.disconnect();

      expect(socket().readyState).toBe(3);
      expect(service.isConnected()).toBeFalse();
    });

    it('should do nothing when never connected', () => {
      expect(() => service.disconnect()).not.toThrow();
    });

    it('should not reconnect after an intentional disconnect', () => {
      service.connect();
      socket().open();

      service.disconnect();
      jasmine.clock().tick(3000);

      expect(FakeWebSocket.instances.length).toBe(1);
    });

    it('should cancel a pending reconnect', () => {
      service.connect();
      socket().open();
      socket().close();

      service.disconnect();
      jasmine.clock().tick(3000);

      expect(FakeWebSocket.instances.length).toBe(1);
    });

    it('should be able to connect again afterwards', () => {
      service.connect();
      socket().open();
      service.disconnect();

      service.connect();

      expect(FakeWebSocket.instances.length).toBe(2);
    });
  });

  describe('messages', () => {
    beforeEach(() => {
      service.connect();
      socket().open();
    });

    const send = (topic: RealtimeTopic, data: unknown) => socket().receive(JSON.stringify({ topic, data }));

    it('should deliver a message to every listener of its topic', () => {
      const first = jasmine.createSpy('first');
      const second = jasmine.createSpy('second');
      service.on(RealtimeTopic.ConsoleLog, first);
      service.on(RealtimeTopic.ConsoleLog, second);

      send(RealtimeTopic.ConsoleLog, { message: 'hello' });

      expect(first).toHaveBeenCalledOnceWith({ message: 'hello' });
      expect(second).toHaveBeenCalledOnceWith({ message: 'hello' });
    });

    it('should not deliver a message to listeners of other topics', () => {
      const listener = jasmine.createSpy('listener');
      service.on(RealtimeTopic.MemoryUsage, listener);

      send(RealtimeTopic.ConsoleLog, {});

      expect(listener).not.toHaveBeenCalled();
    });

    it('should stop delivering after unsubscribing', () => {
      const listener = jasmine.createSpy('listener');
      const unsubscribe = service.on(RealtimeTopic.ConsoleLog, listener);

      unsubscribe();
      send(RealtimeTopic.ConsoleLog, {});

      expect(listener).not.toHaveBeenCalled();
    });

    it('should survive a malformed message', () => {
      const listener = jasmine.createSpy('listener');
      service.on(RealtimeTopic.ConsoleLog, listener);

      expect(() => socket().receive('{broken')).not.toThrow();
      expect(listener).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('should log socket errors', () => {
      socket().onerror?.(new Error('boom'));

      expect(console.error).toHaveBeenCalled();
    });
  });
});
