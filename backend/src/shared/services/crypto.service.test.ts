import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertNotEquals } from '@std/assert';
import { decodeBase64, encodeBase64 } from '@std/encoding';
import { CryptoService } from './crypto.service.ts';
import { useSilentConsole, withEnv } from '../../testing/test-helpers.ts';

describe('CryptoService', () => {
  useSilentConsole();

  let service: CryptoService;
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = withEnv({ ENCRYPTION_SECRET: 'unit-test-secret' });
    service = new CryptoService();
  });

  afterEach(() => restoreEnv());

  it('round-trips a plain text value', async () => {
    const encoded = await service.encode('top secret');

    assertNotEquals(encoded, 'top secret');
    assertEquals(await service.decode(encoded), 'top secret');
  });

  it('round-trips unicode text', async () => {
    assertEquals(await service.decode(await service.encode('árvíztűrő tükörfúrógép 🔐')), 'árvíztűrő tükörfúrógép 🔐');
  });

  it('uses a fresh IV, so the same text encrypts differently each time', async () => {
    const first = await service.encode('same text');
    const second = await service.encode('same text');

    assertNotEquals(first, second);
    assertNotEquals(decodeBase64(first).slice(0, 12), decodeBase64(second).slice(0, 12));
  });

  it('returns an empty string when encoding an empty value', async () => {
    assertEquals(await service.encode(''), '');
  });

  it('returns an empty string when decoding an empty value', async () => {
    assertEquals(await service.decode(''), '');
  });

  it('returns an empty string for a tampered ciphertext', async () => {
    const bytes = decodeBase64(await service.encode('top secret'));
    bytes[bytes.length - 1] ^= 0xff;

    assertEquals(await service.decode(encodeBase64(bytes)), '');
  });

  it('returns an empty string for input that is not base64', async () => {
    assertEquals(await service.decode('***not-base64***'), '');
  });

  it('cannot decode a value encrypted with another secret', async () => {
    const encoded = await service.encode('top secret');
    const restore = withEnv({ ENCRYPTION_SECRET: 'another-secret' });

    try {
      assertEquals(await service.decode(encoded), '');
    } finally {
      restore();
    }
  });
});
