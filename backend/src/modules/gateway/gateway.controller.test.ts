import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { GatewayController } from './gateway.controller.ts';
import { GatewayService } from './gateway.service.ts';
import { assertRejectsHttp, useSilentConsole } from '../../testing/test-helpers.ts';

describe('GatewayController', () => {
  useSilentConsole();

  let forwarded: unknown[][];
  let controller: GatewayController;

  beforeEach(() => {
    forwarded = [];
    controller = new GatewayController({
      forwardRequest: (...args: unknown[]) => {
        forwarded.push(args);
        return Promise.resolve({ ok: true });
      },
    } as unknown as GatewayService);
  });

  it('rejects a missing apiName with 400', async () => {
    await assertRejectsHttp(() => controller.get('pub', 'sig', '', {}), 400, 'apiName parameter is required');
    assertEquals(forwarded.length, 0);
  });

  it('rejects a missing public key with 400', async () => {
    await assertRejectsHttp(() => controller.get('', 'sig', 'weather', {}), 400, 'x-api-public-key');
    assertEquals(forwarded.length, 0);
  });

  it('rejects a missing signature with 400', async () => {
    await assertRejectsHttp(() => controller.get('pub', '', 'weather', {}), 400, 'x-api-signature');
    assertEquals(forwarded.length, 0);
  });

  it('forwards the request without apiName among the parameters and returns the result', async () => {
    const result = await controller.get('pub', 'sig', 'weather', { apiName: 'weather', city: 'Pecs' });

    assertEquals(result, { ok: true });
    assertEquals(forwarded, [['weather', 'pub', 'sig', { city: 'Pecs' }]]);
  });
});
