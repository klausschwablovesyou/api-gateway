import { afterEach, describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { IpSyncService } from './ip-sync.service.ts';
import { IpRepository } from '../repositories/ip.repository.ts';
import { IpSyncStatus } from '@shared/types/ip-sync-status.ts';
import { CommandMock, FakeCommandResult, mockDenoCommand, useSilentConsole } from '../../testing/test-helpers.ts';

const ROUTE_OUTPUT = 'default via 10.0.0.1 dev ens3 proto dhcp metric 100\n';

function createService(options: { windows?: boolean; ips?: string[] } = {}): IpSyncService {
  const repository = {
    findAll: () => Promise.resolve((options.ips ?? []).map((ip, index) => ({ id: `ip-${index}`, ip }))),
  } as unknown as IpRepository;

  const service = new IpSyncService(repository);
  // The platform is read from Deno.build.os at construction; override it so tests behave the same everywhere.
  (service as unknown as { _isWindows: boolean })._isWindows = options.windows ?? false;
  return service;
}

describe('IpSyncService', () => {
  useSilentConsole();

  let command: CommandMock | undefined;

  /** Routes `ip route show default` to a fixed answer and everything else to the given handler. */
  function mockLinux(handler: (args: string[]) => FakeCommandResult): CommandMock {
    command = mockDenoCommand((cmd) => {
      if (cmd.join(' ') === 'ip route show default') {
        return { success: true, stdout: ROUTE_OUTPUT };
      }
      return handler(cmd);
    });
    return command;
  }

  afterEach(() => {
    command?.restore();
    command = undefined;
  });

  describe('getDefaultInterface', () => {
    it('parses the interface from the default route', async () => {
      mockLinux(() => ({ success: true }));

      assertEquals(await createService().getDefaultInterface(), 'ens3');
    });

    it('caches the detected interface', async () => {
      const mock = mockLinux(() => ({ success: true }));
      const service = createService();

      await service.getDefaultInterface();
      await service.getDefaultInterface();

      assertEquals(mock.calls.length, 1);
    });

    it('falls back to eth0 when the output has no interface', async () => {
      command = mockDenoCommand(() => ({ success: true, stdout: '' }));

      assertEquals(await createService().getDefaultInterface(), 'eth0');
    });

    it('falls back to eth0 when the ip binary is unavailable', async () => {
      command = mockDenoCommand(() => {
        throw new Error('ip not found');
      });

      assertEquals(await createService().getDefaultInterface(), 'eth0');
    });

    it('uses the loopback interface on Windows without spawning a process', async () => {
      const mock = command = mockDenoCommand(() => ({ success: true }));

      assertEquals(await createService({ windows: true }).getDefaultInterface(), 'Loopback Pseudo-Interface 1');
      assertEquals(mock.calls.length, 0);
    });
  });

  describe('addIpToNetwork (Linux)', () => {
    it('adds the address as /32 to the default interface', async () => {
      const mock = mockLinux(() => ({ success: true }));

      const result = await createService().addIpToNetwork('1.2.3.4');

      assertEquals(result, { ip: '1.2.3.4', status: IpSyncStatus.Added, verified: null });
      assertEquals(mock.calls.at(-1), ['ip', 'addr', 'add', '1.2.3.4/32', 'dev', 'ens3']);
    });

    it('adds an IPv6 address as /128', async () => {
      const mock = mockLinux(() => ({ success: true }));

      await createService().addIpToNetwork('2001:db8::1');

      assertEquals(mock.calls.at(-1), ['ip', 'addr', 'add', '2001:db8::1/128', 'dev', 'ens3']);
    });

    for (const stderr of ['RTNETLINK answers: File exists', 'Error: ipv4: Address already assigned.']) {
      it(`reports already-exists for "${stderr}"`, async () => {
        mockLinux(() => ({ success: false, stderr }));

        assertEquals((await createService().addIpToNetwork('1.2.3.4')).status, IpSyncStatus.AlreadyExists);
      });
    }

    it('reports failure with the trimmed stderr', async () => {
      mockLinux(() => ({ success: false, stderr: 'RTNETLINK answers: Operation not permitted\n' }));

      assertEquals(await createService().addIpToNetwork('1.2.3.4'), {
        ip: '1.2.3.4',
        status: IpSyncStatus.Failed,
        verified: null,
        error: 'RTNETLINK answers: Operation not permitted',
      });
    });

    it('reports failure instead of throwing when the command cannot run', async () => {
      mockLinux(() => {
        throw new Error('spawn failed');
      });

      assertEquals(await createService().addIpToNetwork('1.2.3.4'), {
        ip: '1.2.3.4',
        status: IpSyncStatus.Failed,
        verified: null,
        error: 'spawn failed',
      });
    });
  });

  describe('addIpToNetwork (Windows)', () => {
    it('adds the address through netsh', async () => {
      const mock = command = mockDenoCommand(() => ({ success: true }));

      const result = await createService({ windows: true }).addIpToNetwork('1.2.3.4');

      assertEquals(result.status, IpSyncStatus.Added);
      assertEquals(mock.calls[0], [
        'netsh', 'interface', 'ip', 'add', 'address', 'Loopback Pseudo-Interface 1', '1.2.3.4', '255.255.255.255',
      ]);
    });

    for (const stderr of ['The address has already been configured', 'Object already exists']) {
      it(`reports already-exists for "${stderr}"`, async () => {
        command = mockDenoCommand(() => ({ success: false, stderr }));

        assertEquals(
          (await createService({ windows: true }).addIpToNetwork('1.2.3.4')).status,
          IpSyncStatus.AlreadyExists,
        );
      });
    }

    it('reports failure for other errors', async () => {
      command = mockDenoCommand(() => ({ success: false, stderr: ' Access denied ' }));

      const result = await createService({ windows: true }).addIpToNetwork('1.2.3.4');

      assertEquals(result.status, IpSyncStatus.Failed);
      assertEquals(result.error, 'Access denied');
    });
  });

  describe('removeIpFromNetwork (Linux)', () => {
    it('removes the address from the default interface', async () => {
      const mock = mockLinux(() => ({ success: true }));

      assertEquals(await createService().removeIpFromNetwork('1.2.3.4'), true);
      assertEquals(mock.calls.at(-1), ['ip', 'addr', 'del', '1.2.3.4/32', 'dev', 'ens3']);
    });

    it('removes an IPv6 address as /128', async () => {
      const mock = mockLinux(() => ({ success: true }));

      assertEquals(await createService().removeIpFromNetwork('2001:db8::1'), true);
      assertEquals(mock.calls.at(-1), ['ip', 'addr', 'del', '2001:db8::1/128', 'dev', 'ens3']);
    });

    it('treats an address that is already gone as success', async () => {
      mockLinux(() => ({ success: false, stderr: 'RTNETLINK answers: Cannot assign requested address' }));

      assertEquals(await createService().removeIpFromNetwork('1.2.3.4'), true);
    });

    it('returns false for other errors', async () => {
      mockLinux(() => ({ success: false, stderr: 'Operation not permitted' }));

      assertEquals(await createService().removeIpFromNetwork('1.2.3.4'), false);
    });

    it('returns false when the command cannot run', async () => {
      mockLinux(() => {
        throw new Error('spawn failed');
      });

      assertEquals(await createService().removeIpFromNetwork('1.2.3.4'), false);
    });
  });

  describe('removeIpFromNetwork (Windows)', () => {
    it('removes the address through netsh', async () => {
      const mock = command = mockDenoCommand(() => ({ success: true }));

      assertEquals(await createService({ windows: true }).removeIpFromNetwork('1.2.3.4'), true);
      assertEquals(mock.calls[0], [
        'netsh', 'interface', 'ip', 'delete', 'address', 'Loopback Pseudo-Interface 1', '1.2.3.4',
      ]);
    });

    it('treats a missing address as success', async () => {
      command = mockDenoCommand(() => ({ success: false, stderr: 'Element not found.' }));

      assertEquals(await createService({ windows: true }).removeIpFromNetwork('1.2.3.4'), true);
    });

    it('returns false for other errors', async () => {
      command = mockDenoCommand(() => ({ success: false, stderr: 'Access denied' }));

      assertEquals(await createService({ windows: true }).removeIpFromNetwork('1.2.3.4'), false);
    });
  });

  describe('syncIpsToNetwork', () => {
    const ADDR_SHOW = [
      '2: ens3    inet 1.2.3.4/32 scope global ens3\\       valid_lft forever',
      '2: ens3    inet6 2001:db8::1/128 scope global \\       valid_lft forever',
    ].join('\n');

    function mockSync(addFails: string[] = [], addrShow: FakeCommandResult = { success: true, stdout: ADDR_SHOW }) {
      return mockLinux((cmd) => {
        if (cmd.join(' ') === 'ip -o addr show') {
          return addrShow;
        }
        return addFails.some((ip) => cmd.includes(`${ip}/32`))
          ? { success: false, stderr: 'Operation not permitted' }
          : { success: true };
      });
    }

    it('returns an empty summary when the database has no IPs', async () => {
      const mock = mockSync();

      assertEquals(await createService({ ips: [] }).syncIpsToNetwork(), {
        networkInterface: 'ens3',
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      });
      assertEquals(mock.calls.length, 1);
    });

    it('adds each address and marks the ones bound to the interface as verified', async () => {
      mockSync();

      const summary = await createService({ ips: ['1.2.3.4', '2001:db8::1'] }).syncIpsToNetwork();

      assertEquals(summary.total, 2);
      assertEquals(summary.succeeded, 2);
      assertEquals(summary.failed, 0);
      assertEquals(summary.results.map((result) => result.verified), [true, true]);
    });

    it('counts an address that was added but is not bound as failed', async () => {
      mockSync();

      const summary = await createService({ ips: ['1.2.3.4', '9.9.9.9'] }).syncIpsToNetwork();

      assertEquals(summary.succeeded, 1);
      assertEquals(summary.failed, 1);
      assertEquals(summary.results[1].status, IpSyncStatus.Added);
      assertEquals(summary.results[1].verified, false);
    });

    it('counts an address whose add command failed as failed, once', async () => {
      mockSync(['9.9.9.9']);

      const summary = await createService({ ips: ['9.9.9.9'] }).syncIpsToNetwork();

      assertEquals(summary.total, 1);
      assertEquals(summary.failed, 1);
      assertEquals(summary.succeeded, 0);
      assertEquals(summary.results[0].status, IpSyncStatus.Failed);
    });

    it('leaves results unverified when assigned addresses cannot be read', async () => {
      mockSync([], { success: false, stderr: 'boom' });

      const summary = await createService({ ips: ['1.2.3.4'] }).syncIpsToNetwork();

      assertEquals(summary.results[0].verified, null);
      assertEquals(summary.succeeded, 1);
      assertEquals(summary.failed, 0);
    });

    it('leaves results unverified when reading assigned addresses throws', async () => {
      mockLinux((cmd) => {
        if (cmd.join(' ') === 'ip -o addr show') {
          throw new Error('spawn failed');
        }
        return { success: true };
      });

      const summary = await createService({ ips: ['1.2.3.4'] }).syncIpsToNetwork();

      assertEquals(summary.results[0].verified, null);
    });

    it('leaves results unverified on Windows', async () => {
      const mock = command = mockDenoCommand(() => ({ success: true }));

      const summary = await createService({ windows: true, ips: ['1.2.3.4'] }).syncIpsToNetwork();

      assertEquals(summary.results[0].verified, null);
      assertEquals(summary.succeeded, 1);
      assertEquals(mock.calls.length, 1);
    });
  });
});
