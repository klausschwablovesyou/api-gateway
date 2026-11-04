import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertNotEquals, assertRejects } from '@std/assert';
import { decodeBase64, decodeHex, encodeBase64 } from '@std/encoding';
import { ApiKeyService } from './api-key.service.ts';

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(() => {
    service = new ApiKeyService();
  });

  describe('generateKeyPair', () => {
    it('generates base64 encoded 32 byte keys', () => {
      const { publicKey, privateKey } = service.generateKeyPair();

      assertEquals(decodeBase64(publicKey).length, 32);
      assertEquals(decodeBase64(privateKey).length, 32);
    });

    it('generates distinct keys on every call', () => {
      const first = service.generateKeyPair();
      const second = service.generateKeyPair();

      assertNotEquals(first.publicKey, first.privateKey);
      assertNotEquals(first.publicKey, second.publicKey);
      assertNotEquals(first.privateKey, second.privateKey);
    });
  });

  describe('generateSignature', () => {
    it('matches the RFC 4231 HMAC-SHA256 test vector', async () => {
      const key = encodeBase64(new TextEncoder().encode('Jefe'));
      const expected = encodeBase64(
        decodeHex('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'),
      );

      assertEquals(await service.generateSignature('what do ya want for nothing?', key), expected);
    });

    it('is deterministic for the same input', async () => {
      const { privateKey } = service.generateKeyPair();

      assertEquals(
        await service.generateSignature('weather', privateKey),
        await service.generateSignature('weather', privateKey),
      );
    });

    it('rejects a private key that is not valid base64', async () => {
      await assertRejects(() => service.generateSignature('weather', '***not-base64***'));
    });
  });

  describe('validateSignature', () => {
    it('accepts the signature generated with the same key and api name', async () => {
      const { privateKey } = service.generateKeyPair();
      const signature = await service.generateSignature('weather', privateKey);

      assertEquals(await service.validateSignature('weather', signature, privateKey), true);
    });

    it('rejects a signature created for another api name', async () => {
      const { privateKey } = service.generateKeyPair();
      const signature = await service.generateSignature('weather', privateKey);

      assertEquals(await service.validateSignature('payments', signature, privateKey), false);
    });

    it('rejects a signature created with another key', async () => {
      const signature = await service.generateSignature('weather', service.generateKeyPair().privateKey);

      assertEquals(
        await service.validateSignature('weather', signature, service.generateKeyPair().privateKey),
        false,
      );
    });

    it('rejects an empty signature', async () => {
      assertEquals(await service.validateSignature('weather', '', service.generateKeyPair().privateKey), false);
    });
  });
});
