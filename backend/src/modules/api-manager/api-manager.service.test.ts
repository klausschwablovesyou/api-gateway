import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { ApiManagerService } from './api-manager.service.ts';
import { ApiRepository } from '../../shared/repositories/api.repository.ts';
import { ApiKeyService } from '../../shared/services/api-key.service.ts';
import { HttpMethod } from '@shared/types/http-method.ts';
import { RequestLimitUnit } from '@shared/types/request-limit-unit.ts';
import { assertRejectsHttp } from '../../testing/test-helpers.ts';

const EXISTING = {
  id: 'api-1',
  name: 'weather',
  apiUrl: 'https://example.com',
  method: HttpMethod.GET,
  publicKey: 'old-public',
  privateKey: 'old-private',
  requestLimit: 10,
  requestLimitUnit: RequestLimitUnit.Minute,
};

const DTO = {
  name: 'weather',
  apiUrl: 'https://example.com',
  method: HttpMethod.GET,
  requestLimit: 10,
  requestLimitUnit: RequestLimitUnit.Minute,
};

describe('ApiManagerService', () => {
  let byId: Record<string, unknown> | null;
  let byName: Record<string, unknown> | null;
  let operations: Array<[string, ...unknown[]]>;
  let service: ApiManagerService;

  beforeEach(() => {
    byId = EXISTING;
    byName = null;
    operations = [];

    service = new ApiManagerService(
      {
        findById: () => Promise.resolve(byId),
        findByName: () => Promise.resolve(byName),
        findAll: () => Promise.resolve([EXISTING]),
        create: (api: Record<string, unknown>) => {
          operations.push(['create', api]);
          return Promise.resolve({ id: 'new-id', ...api });
        },
        update: (id: string, dto: unknown) => {
          operations.push(['update', id, dto]);
          return Promise.resolve(EXISTING);
        },
        delete: (id: string) => {
          operations.push(['delete', id]);
          return Promise.resolve(true);
        },
      } as unknown as ApiRepository,
      {
        generateKeyPair: () => ({ publicKey: 'new-public', privateKey: 'new-private' }),
      } as unknown as ApiKeyService,
    );
  });

  describe('create', () => {
    it('rejects a duplicate name with 409', async () => {
      byName = EXISTING;

      await assertRejectsHttp(() => service.create(DTO), 409, 'already exists');
      assertEquals(operations.length, 0);
    });

    it('stores the API with a generated key pair', async () => {
      const created = await service.create(DTO);

      assertEquals(created.publicKey, 'new-public');
      assertEquals(operations, [['create', { ...DTO, publicKey: 'new-public', privateKey: 'new-private' }]]);
    });

    it('ignores keys supplied by the caller', async () => {
      await service.create({ ...DTO, publicKey: 'chosen', privateKey: 'chosen' } as never);

      const stored = operations[0][1] as Record<string, unknown>;
      assertEquals(stored.publicKey, 'new-public');
      assertEquals(stored.privateKey, 'new-private');
    });
  });

  it('findAll and findById delegate to the repository', async () => {
    assertEquals(await service.findAll(), [EXISTING] as never);
    assertEquals(await service.findById('api-1'), EXISTING as never);
  });

  describe('update', () => {
    it('rejects an unknown id with 404', async () => {
      byId = null;

      await assertRejectsHttp(() => service.update('missing', { name: 'x' }), 404);
      assertEquals(operations.length, 0);
    });

    it('rejects renaming to a name that is taken with 409', async () => {
      byName = { ...EXISTING, id: 'api-2', name: 'taken' };

      await assertRejectsHttp(() => service.update('api-1', { name: 'taken' }), 409);
      assertEquals(operations.length, 0);
    });

    it('allows saving with the unchanged name, without a uniqueness conflict', async () => {
      byName = EXISTING;

      await service.update('api-1', { name: EXISTING.name, requestLimit: 5 });

      assertEquals(operations, [['update', 'api-1', { name: EXISTING.name, requestLimit: 5 }]]);
    });

    it('allows renaming to a free name', async () => {
      await service.update('api-1', { name: 'free' });

      assertEquals(operations, [['update', 'api-1', { name: 'free' }]]);
    });
  });

  describe('delete', () => {
    it('rejects an unknown id with 404', async () => {
      byId = null;

      await assertRejectsHttp(() => service.delete('missing'), 404);
      assertEquals(operations.length, 0);
    });

    it('deletes an existing API', async () => {
      assertEquals(await service.delete('api-1'), true);
      assertEquals(operations, [['delete', 'api-1']]);
    });
  });

  describe('regenerateKeys', () => {
    it('rejects an unknown id with 404', async () => {
      byId = null;

      await assertRejectsHttp(() => service.regenerateKeys('missing'), 404);
      assertEquals(operations.length, 0);
    });

    it('recreates the API with new keys and the same settings', async () => {
      const result = await service.regenerateKeys('api-1');

      assertEquals(result.publicKey, 'new-public');
      assertEquals(result.privateKey, 'new-private');
      assertEquals(operations, [
        ['delete', 'api-1'],
        ['create', { ...DTO, publicKey: 'new-public', privateKey: 'new-private' }],
      ]);
    });
  });
});
