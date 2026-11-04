import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { IpManagerService } from './ip-manager.service.ts';
import { IpRepository } from '../../shared/repositories/ip.repository.ts';
import { IpSyncService } from '../../shared/services/ip-sync.service.ts';
import { assertRejectsHttp } from '../../testing/test-helpers.ts';

const EXISTING = { id: 'ip-1', ip: '1.1.1.1' };

describe('IpManagerService', () => {
  let byId: typeof EXISTING | null;
  let byIp: typeof EXISTING | null;
  let operations: Array<[string, ...unknown[]]>;
  let service: IpManagerService;

  beforeEach(() => {
    byId = EXISTING;
    byIp = null;
    operations = [];

    service = new IpManagerService(
      {
        findById: () => Promise.resolve(byId),
        findByIp: () => Promise.resolve(byIp),
        findAll: () => Promise.resolve([EXISTING]),
        create: (value: { ip: string }) => {
          operations.push(['db.create', value]);
          return Promise.resolve({ id: 'new-id', ...value });
        },
        update: (id: string, dto: unknown) => {
          operations.push(['db.update', id, dto]);
          return Promise.resolve(EXISTING);
        },
        delete: (id: string) => {
          operations.push(['db.delete', id]);
          return Promise.resolve(true);
        },
      } as unknown as IpRepository,
      {
        addIpToNetwork: (ip: string) => {
          operations.push(['network.add', ip]);
          return Promise.resolve({});
        },
        removeIpFromNetwork: (ip: string) => {
          operations.push(['network.remove', ip]);
          return Promise.resolve(true);
        },
        syncIpsToNetwork: () => Promise.resolve({ total: 3 }),
      } as unknown as IpSyncService,
    );
  });

  describe('create', () => {
    it('rejects a duplicate address with 409', async () => {
      byIp = EXISTING;

      await assertRejectsHttp(() => service.create({ ip: EXISTING.ip }), 409, 'IP already exists');
      assertEquals(operations.length, 0);
    });

    it('stores the address, then adds it to the network', async () => {
      const created = await service.create({ ip: '2.2.2.2' });

      assertEquals(created, { id: 'new-id', ip: '2.2.2.2' });
      assertEquals(operations, [['db.create', { ip: '2.2.2.2' }], ['network.add', '2.2.2.2']]);
    });
  });

  it('findAll and findById delegate to the repository', async () => {
    assertEquals(await service.findAll(), [EXISTING]);
    assertEquals(await service.findById('ip-1'), EXISTING);
  });

  describe('update', () => {
    it('rejects an unknown id with 404', async () => {
      byId = null;

      await assertRejectsHttp(() => service.update('missing', { ip: '2.2.2.2' }), 404, 'IP not found');
      assertEquals(operations.length, 0);
    });

    it('rejects an address that is taken with 409, and leaves the network alone', async () => {
      byIp = { id: 'ip-2', ip: '2.2.2.2' };

      await assertRejectsHttp(() => service.update('ip-1', { ip: '2.2.2.2' }), 409);
      assertEquals(operations.length, 0);
    });

    it('swaps the address on the network, then stores it', async () => {
      await service.update('ip-1', { ip: '2.2.2.2' });

      assertEquals(operations, [
        ['network.remove', '1.1.1.1'],
        ['network.add', '2.2.2.2'],
        ['db.update', 'ip-1', { ip: '2.2.2.2' }],
      ]);
    });

    it('leaves the network alone when the address does not change', async () => {
      await service.update('ip-1', { ip: EXISTING.ip });

      assertEquals(operations, [['db.update', 'ip-1', { ip: EXISTING.ip }]]);
    });
  });

  describe('delete', () => {
    it('rejects an unknown id with 404', async () => {
      byId = null;

      await assertRejectsHttp(() => service.delete('missing'), 404);
      assertEquals(operations.length, 0);
    });

    it('removes the address from the network, then deletes it', async () => {
      assertEquals(await service.delete('ip-1'), true);
      assertEquals(operations, [['network.remove', '1.1.1.1'], ['db.delete', 'ip-1']]);
    });
  });

  it('syncAll delegates to the sync service', async () => {
    assertEquals(await service.syncAll(), { total: 3 } as never);
  });
});
