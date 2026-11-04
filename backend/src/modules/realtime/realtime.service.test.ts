import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { FakeTime } from '@std/testing/time';
import { RealtimeService } from './realtime.service.ts';
import { RealtimeTopic } from '@shared/types/realtime-topic.ts';
import { UserRole } from '@shared/types/user-role.ts';
import { FakeSocket, useSilentConsole } from '../../testing/test-helpers.ts';

describe('RealtimeService', () => {
  useSilentConsole();

  let service: RealtimeService;

  const connect = (userId: string, role: UserRole, readyState = WebSocket.OPEN): FakeSocket => {
    const socket = new FakeSocket(readyState);
    service.addClient(userId, role, socket.asWebSocket());
    return socket;
  };

  const message = (topic: RealtimeTopic, data: unknown = null) => JSON.stringify({ topic, data });

  beforeEach(() => {
    service = new RealtimeService();
  });

  describe('client tracking', () => {
    it('counts the connections of every user', () => {
      assertEquals(service.getClientCount(), 0);

      connect('user-1', UserRole.User);
      connect('user-1', UserRole.User);
      connect('user-2', UserRole.Admin);

      assertEquals(service.getClientCount(), 3);
    });

    it('removes only the closed connection', () => {
      const first = connect('user-1', UserRole.User);
      const second = connect('user-1', UserRole.User);

      first.onclose!();
      service.notifyClients('user-1', RealtimeTopic.ConsoleLog);

      assertEquals(service.getClientCount(), 1);
      assertEquals(first.sent.length, 0);
      assertEquals(second.sent.length, 1);
    });

    it('forgets a user after the last connection closes', () => {
      connect('user-1', UserRole.User).onclose!();

      assertEquals(service.getClientCount(), 0);
      assertEquals((service as unknown as { _clients: Map<string, unknown> })._clients.has('user-1'), false);
    });
  });

  describe('notifyClients', () => {
    it('sends to every open connection of the user only', () => {
      const first = connect('user-1', UserRole.User);
      const second = connect('user-1', UserRole.User);
      const other = connect('user-2', UserRole.User);

      service.notifyClients('user-1', RealtimeTopic.ConsoleLog, { a: 1 });

      const expected = [message(RealtimeTopic.ConsoleLog, { a: 1 })];
      assertEquals(first.sent, expected);
      assertEquals(second.sent, expected);
      assertEquals(other.sent, []);
    });

    it('skips connections that are not open', () => {
      const closing = connect('user-1', UserRole.User, WebSocket.CLOSING);

      service.notifyClients('user-1', RealtimeTopic.ConsoleLog);

      assertEquals(closing.sent, []);
    });

    it('does nothing for a user without connections', () => {
      service.notifyClients('nobody', RealtimeTopic.ConsoleLog);

      assertEquals(service.getClientCount(), 0);
    });
  });

  describe('notifyByRole', () => {
    it('sends only to open connections with the role', () => {
      const superAdmin = connect('user-1', UserRole.SuperAdmin);
      const closedSuperAdmin = connect('user-2', UserRole.SuperAdmin, WebSocket.CLOSED);
      const admin = connect('user-3', UserRole.Admin);

      service.notifyByRole(UserRole.SuperAdmin, RealtimeTopic.RequestError);

      assertEquals(superAdmin.sent, [message(RealtimeTopic.RequestError)]);
      assertEquals(closedSuperAdmin.sent, []);
      assertEquals(admin.sent, []);
    });
  });

  describe('broadcast', () => {
    it('sends to every open connection', () => {
      const first = connect('user-1', UserRole.User);
      const second = connect('user-2', UserRole.SuperAdmin);
      const closed = connect('user-3', UserRole.User, WebSocket.CLOSED);

      service.broadcast(RealtimeTopic.ConsoleLog, 'hello');

      assertEquals(first.sent, [message(RealtimeTopic.ConsoleLog, 'hello')]);
      assertEquals(second.sent, [message(RealtimeTopic.ConsoleLog, 'hello')]);
      assertEquals(closed.sent, []);
    });
  });

  describe('memory broadcast', () => {
    let time: FakeTime;

    const start = () => (service as unknown as { _startMemoryBroadcast(): void })._startMemoryBroadcast();
    const stop = () => clearInterval((service as unknown as { _memoryInterval: number })._memoryInterval);

    beforeEach(() => {
      time = new FakeTime();
    });

    afterEach(() => {
      stop();
      time.restore();
    });

    it('reports the estimated usage to SuperAdmins every 5 seconds', () => {
      const superAdmin = connect('user-1', UserRole.SuperAdmin);
      const user = connect('user-2', UserRole.User);
      service.setDbConnectionCount(3);
      service.setTelegramStatsProvider(() => ({ totalClients: 4, activeClients: 2 }));

      start();
      time.tick(4999);
      assertEquals(superAdmin.sent.length, 0);
      time.tick(1);

      assertEquals(superAdmin.sent.length, 1);
      assertEquals(user.sent, []);

      const { topic, data } = JSON.parse(superAdmin.sent[0]);
      assertEquals(topic, RealtimeTopic.MemoryUsage);
      assertEquals(data.telegram, { count: 2, estimated: 2 * 5 * 1024 * 1024 });
      assertEquals(data.realtime, { count: 2, estimated: 2 * 50 * 1024 });
      assertEquals(data.database, { count: 3, estimated: 3 * 2 * 1024 * 1024 });
      assertEquals(typeof data.backend.heapUsed, 'number');
    });

    it('reports zero Telegram clients without a stats provider', () => {
      const superAdmin = connect('user-1', UserRole.SuperAdmin);

      start();
      time.tick(5000);

      assertEquals(JSON.parse(superAdmin.sent[0]).data.telegram, { count: 0, estimated: 0 });
    });
  });
});
