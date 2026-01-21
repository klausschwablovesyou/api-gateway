import { Injectable } from '@danet/core';
import { IpRepository } from '../repositories/ip.repository.ts';

@Injectable()
export class IpSyncService {
  private _networkInterface: string | null = null;

  constructor(private readonly _ipRepository: IpRepository) {}

  async verifyIpWorks(ip: string): Promise<{ success: boolean; detectedIp?: string; error?: string }> {
    console.log(`[IpSync] Verifying IP ${ip} can make outbound requests...`);

    // Small delay to ensure IP is fully registered on the interface
    await new Promise((r) => setTimeout(r, 1000));

    // Check if IP is actually on the interface
    const networkInterface = await this.getDefaultInterface();
    const isOnInterface = await this._checkIpOnInterface(ip, networkInterface);
    console.log(`[IpSync] IP ${ip} on ${networkInterface}: ${isOnInterface}`);

    if (!isOnInterface) {
      return { success: false, error: `IP ${ip} not found on interface ${networkInterface}` };
    }

    // Use Deno's native HTTP client with localAddress
    const client = Deno.createHttpClient({
      localAddress: ip,
    });

    try {
      const response = await fetch('https://api.ipify.org', { client });
      const detectedIp = (await response.text()).trim();

      console.log(`[IpSync] Detected IP: ${detectedIp}`);

      if (detectedIp === ip) {
        console.log(`[IpSync] ✓ Verified: ${ip} - outbound IP matches`);
        return { success: true, detectedIp };
      } else {
        console.error(`[IpSync] ✗ Verification failed: expected ${ip}, got ${detectedIp}`);
        return { success: false, detectedIp, error: `IP mismatch: expected ${ip}, got ${detectedIp}` };
      }
    } catch (err) {
      console.error(`[IpSync] ✗ Verification failed for ${ip}:`, err);
      return { success: false, error: String(err) };
    } finally {
      client.close();
    }
  }

  private async _checkIpOnInterface(ip: string, networkInterface: string): Promise<boolean> {
    try {
      const command = new Deno.Command('ip', {
        args: ['addr', 'show', 'dev', networkInterface],
      });
      const result = await command.output();
      const output = new TextDecoder().decode(result.stdout);
      console.log(`[IpSync] Interface ${networkInterface} addresses:\n${output}`);
      return output.includes(ip);
    } catch (err) {
      console.error(`[IpSync] Failed to check interface:`, err);
      return false;
    }
  }

  async getDefaultInterface(): Promise<string> {
    if (this._networkInterface) {
      return this._networkInterface;
    }

    try {
      const command = new Deno.Command('ip', {
        args: ['route', 'show', 'default'],
      });
      const result = await command.output();
      const output = new TextDecoder().decode(result.stdout);

      const match = output.match(/dev\s+(\S+)/);
      if (match && match[1]) {
        this._networkInterface = match[1];
        return this._networkInterface;
      }
    } catch (err) {
      console.error('[IpSync] Failed to detect network interface:', err);
    }

    return 'eth0';
  }

  async addIpToNetwork(ip: string): Promise<boolean> {
    const networkInterface = await this.getDefaultInterface();
    console.log(`[IpSync] Adding IP ${ip} to ${networkInterface}`);

    try {
      const command = new Deno.Command('ip', {
        args: ['addr', 'add', `${ip}/32`, 'dev', networkInterface],
      });
      const result = await command.output();

      if (result.success) {
        console.log(`[IpSync] ✓ Added: ${ip}`);
        return true;
      } else {
        const stderr = new TextDecoder().decode(result.stderr);
        if (stderr.includes('RTNETLINK answers: File exists')) {
          console.log(`[IpSync] ✓ Already exists: ${ip}`);
          return true;
        } else {
          console.error(`[IpSync] ✗ Failed to add: ${ip} - ${stderr.trim()}`);
          return false;
        }
      }
    } catch (err) {
      console.error(`[IpSync] ✗ Error adding: ${ip} -`, err);
      return false;
    }
  }

  async removeIpFromNetwork(ip: string): Promise<boolean> {
    const networkInterface = await this.getDefaultInterface();
    console.log(`[IpSync] Removing IP ${ip} from ${networkInterface}`);

    try {
      const command = new Deno.Command('ip', {
        args: ['addr', 'del', `${ip}/32`, 'dev', networkInterface],
      });
      const result = await command.output();

      if (result.success) {
        console.log(`[IpSync] ✓ Removed: ${ip}`);
        return true;
      } else {
        const stderr = new TextDecoder().decode(result.stderr);
        if (stderr.includes('Cannot assign requested address')) {
          console.log(`[IpSync] ✓ Already removed: ${ip}`);
          return true;
        } else {
          console.error(`[IpSync] ✗ Failed to remove: ${ip} - ${stderr.trim()}`);
          return false;
        }
      }
    } catch (err) {
      console.error(`[IpSync] ✗ Error removing: ${ip} -`, err);
      return false;
    }
  }

  async syncIpsToNetwork(): Promise<void> {
    const networkInterface = await this.getDefaultInterface();
    console.log(`[IpSync] Using network interface: ${networkInterface}`);

    const ips = await this._ipRepository.findAll();

    if (ips.length === 0) {
      console.log('[IpSync] No IPs in database to sync');
      return;
    }

    console.log(`[IpSync] Found ${ips.length} IPs in database`);

    for (let i = 0; i < ips.length; i++) {
      const ip = ips[i];
      console.log(`[IpSync] Syncing IP ${i + 1}/${ips.length}: ${ip.ip}`);
      await this.addIpToNetwork(ip.ip);
    }

    console.log('[IpSync] Sync complete');
  }
}
