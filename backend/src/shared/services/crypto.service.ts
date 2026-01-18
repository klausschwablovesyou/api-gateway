import { Injectable } from '@danet/core';
import { encodeBase64, decodeBase64 } from '@std/encoding';

@Injectable()
export class CryptoService {
  private readonly _algorithm = 'AES-GCM';
  private readonly _keyLength = 256;
  private readonly _ivLength = 12;

  private async getKey(): Promise<CryptoKey> {
    const secret = Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-change-me';
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('telegram-bot-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this._algorithm, length: this._keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  public async encode(plainText: string): Promise<string> {
    if (!plainText) {
      return '';
    }

    const key = await this.getKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(this._ivLength));

    const encrypted = await crypto.subtle.encrypt(
      { name: this._algorithm, iv },
      key,
      encoder.encode(plainText)
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return encodeBase64(combined);
  }

  public async decode(encodedText: string): Promise<string> {
    if (!encodedText) {
      return '';
    }

    try {
      const key = await this.getKey();
      const combined = decodeBase64(encodedText);
      const iv = combined.slice(0, this._ivLength);
      const encrypted = combined.slice(this._ivLength);

      const decrypted = await crypto.subtle.decrypt(
        { name: this._algorithm, iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('[CryptoService] Failed to decode:', error);
      return '';
    }
  }
}
