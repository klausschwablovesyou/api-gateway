import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { ConfigManagerService } from './config-manager.service.ts';
import { ConfigRepository } from '../../shared/repositories/config.repository.ts';

describe('ConfigManagerService', () => {
  let store: Map<string, string>;
  let writes: string[][];
  let service: ConfigManagerService;

  beforeEach(() => {
    store = new Map();
    writes = [];
    service = new ConfigManagerService({
      get: (key: string) => Promise.resolve(store.has(key) ? { key, value: store.get(key) } : null),
      set: (key: string, value: string) => {
        writes.push([key, value]);
        store.set(key, value);
        return Promise.resolve({ key, value });
      },
    } as unknown as ConfigRepository);
  });

  const values: Array<[string | null, boolean]> = [['true', true], ['false', false], ['1', false], [null, false]];

  for (const [stored, expected] of values) {
    it(`treats a stored value of ${stored} as ${expected}`, async () => {
      if (stored !== null) {
        store.set('enableRegistration', stored);
      }

      assertEquals(await service.isRegistrationEnabled(), expected);
      assertEquals(await service.getConfig(), { enableRegistration: expected });
    });
  }

  it('stores a boolean as a string and returns the new config', async () => {
    assertEquals(await service.updateConfig({ enableRegistration: true }), { enableRegistration: true });
    assertEquals(writes, [['enableRegistration', 'true']]);
  });

  it('can disable registration', async () => {
    store.set('enableRegistration', 'true');

    assertEquals(await service.updateConfig({ enableRegistration: false }), { enableRegistration: false });
    assertEquals(writes, [['enableRegistration', 'false']]);
  });

  it('writes nothing when the value is not provided', async () => {
    store.set('enableRegistration', 'true');

    assertEquals(await service.updateConfig({}), { enableRegistration: true });
    assertEquals(writes.length, 0);
  });
});
