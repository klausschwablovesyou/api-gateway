import { Injectable } from '@danet/core';
import { encodeBase64, decodeBase64 } from '@std/encoding';

export interface ApiKeyPair {
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class ApiKeyService {
  public generateKeyPair(): ApiKeyPair {
    const publicKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));

    return {
      publicKey: encodeBase64(publicKeyBytes),
      privateKey: encodeBase64(privateKeyBytes),
    };
  }

  public async generateSignature(apiName: string, privateKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiName);
    const keyData = decodeBase64(privateKey);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return encodeBase64(new Uint8Array(signature));
  }

  public async validateSignature(
    apiName: string,
    providedSignature: string,
    privateKey: string
  ): Promise<boolean> {
    const expectedSignature = await this.generateSignature(apiName, privateKey);
    return providedSignature === expectedSignature;
  }
}
