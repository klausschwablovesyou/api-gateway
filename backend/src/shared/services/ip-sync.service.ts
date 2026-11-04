import { Injectable } from '@danet/core';
import { IpRepository } from '../repositories/ip.repository.ts';
import { IpSyncStatus } from '@shared/types/ip-sync-status.ts';
import { IpSyncResultDto } from '@shared/dtos/ip-sync-result.dto.ts';
import { IpSyncResponseDto } from '@shared/dtos/ip-sync-response.dto.ts';

@Injectable()
export class IpSyncService {
  private _networkInterface: string | null = null;
  private readonly _isWindows = Deno.build.os === 'windows';

  constructor(private readonly _ipRepository: IpRepository) {}

  async getDefaultInterface(): Promise<string> {
    if (this._networkInterface) {
      return this._networkInterface;
    }

    if (this._isWindows) {
      this._networkInterface = 'Loopback Pseudo-Interface 1';
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

  async addIpToNetwork(ip: string): Promise<IpSyncResultDto> {
    const networkInterface = await this.getDefaultInterface();
    console.log(`[IpSync] Adding IP ${ip} to ${networkInterface}`);

    try {
      if (this._isWindows) {
        return await this._addIpWindows(ip, networkInterface);
      } else {
        return await this._addIpLinux(ip, networkInterface);
      }
    } catch (err) {
      console.error(`[IpSync] ✗ Error adding: ${ip} -`, err);
      return {
        ip,
        status: IpSyncStatus.Failed,
        verified: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private _toHostCidr(ip: string): string {
    return ip.includes(':') ? `${ip}/128` : `${ip}/32`;
  }

  private async _addIpLinux(ip: string, networkInterface: string): Promise<IpSyncResultDto> {
    const command = new Deno.Command('ip', {
      args: ['addr', 'add', this._toHostCidr(ip), 'dev', networkInterface],
    });
    const result = await command.output();

    if (result.success) {
      console.log(`[IpSync] ✓ Added: ${ip}`);
      return { ip, status: IpSyncStatus.Added, verified: null };
    } else {
      const stderr = new TextDecoder().decode(result.stderr);
      if (stderr.includes('RTNETLINK answers: File exists') || stderr.includes('Address already assigned')) {
        console.log(`[IpSync] ✓ Already exists: ${ip}`);
        return { ip, status: IpSyncStatus.AlreadyExists, verified: null };
      } else {
        console.error(`[IpSync] ✗ Failed to add: ${ip} - ${stderr.trim()}`);
        return { ip, status: IpSyncStatus.Failed, verified: null, error: stderr.trim() };
      }
    }
  }

  private async _addIpWindows(ip: string, networkInterface: string): Promise<IpSyncResultDto> {
    const command = new Deno.Command('netsh', {
      args: ['interface', 'ip', 'add', 'address', networkInterface, ip, '255.255.255.255'],
    });
    const result = await command.output();

    if (result.success) {
      console.log(`[IpSync] ✓ Added: ${ip}`);
      return { ip, status: IpSyncStatus.Added, verified: null };
    } else {
      const stderr = new TextDecoder().decode(result.stderr);
      if (stderr.includes('already been configured') || stderr.includes('Object already exists')) {
        console.log(`[IpSync] ✓ Already exists: ${ip}`);
        return { ip, status: IpSyncStatus.AlreadyExists, verified: null };
      } else {
        console.error(`[IpSync] ✗ Failed to add: ${ip} - ${stderr.trim()}`);
        return { ip, status: IpSyncStatus.Failed, verified: null, error: stderr.trim() };
      }
    }
  }

  async removeIpFromNetwork(ip: string): Promise<boolean> {
    const networkInterface = await this.getDefaultInterface();
    console.log(`[IpSync] Removing IP ${ip} from ${networkInterface}`);

    try {
      if (this._isWindows) {
        return await this._removeIpWindows(ip, networkInterface);
      } else {
        return await this._removeIpLinux(ip, networkInterface);
      }
    } catch (err) {
      console.error(`[IpSync] ✗ Error removing: ${ip} -`, err);
      return false;
    }
  }

  private async _removeIpLinux(ip: string, networkInterface: string): Promise<boolean> {
    const command = new Deno.Command('ip', {
      args: ['addr', 'del', this._toHostCidr(ip), 'dev', networkInterface],
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
  }

  private async _removeIpWindows(ip: string, networkInterface: string): Promise<boolean> {
    const command = new Deno.Command('netsh', {
      args: ['interface', 'ip', 'delete', 'address', networkInterface, ip],
    });
    const result = await command.output();

    if (result.success) {
      console.log(`[IpSync] ✓ Removed: ${ip}`);
      return true;
    } else {
      const stderr = new TextDecoder().decode(result.stderr);
      if (stderr.includes('not found') || stderr.includes('Element not found')) {
        console.log(`[IpSync] ✓ Already removed: ${ip}`);
        return true;
      } else {
        console.error(`[IpSync] ✗ Failed to remove: ${ip} - ${stderr.trim()}`);
        return false;
      }
    }
  }

  async syncIpsToNetwork(): Promise<IpSyncResponseDto> {
    const networkInterface = await this.getDefaultInterface();
    console.log(`[IpSync] Using network interface: ${networkInterface}`);

    const ips = await this._ipRepository.findAll();
    const results: IpSyncResultDto[] = [];

    if (ips.length === 0) {
      console.log('[IpSync] No IPs in database to sync');
      return { networkInterface, total: 0, succeeded: 0, failed: 0, results };
    }

    console.log(`[IpSync] Found ${ips.length} IPs in database`);

    for (let i = 0; i < ips.length; i++) {
      const ip = ips[i];
      console.log(`[IpSync] Syncing IP ${i + 1}/${ips.length}: ${ip.ip}`);
      results.push(await this.addIpToNetwork(ip.ip));
    }

    await this._verifyResults(results);

    const failed = results.filter((result) => result.status === IpSyncStatus.Failed || result.verified === false).length;
    const succeeded = results.length - failed;

    console.log(`[IpSync] Sync complete: ${succeeded}/${results.length} usable, ${failed} failed`);

    return { networkInterface, total: results.length, succeeded, failed, results };
  }

  private async _verifyResults(results: IpSyncResultDto[]): Promise<void> {
    const assignedIps = await this._getAssignedIps();

    if (!assignedIps) {
      console.warn('[IpSync] Could not read assigned addresses, sync results are unverified');
      return;
    }

    for (const result of results) {
      result.verified = assignedIps.has(result.ip);

      if (!result.verified) {
        console.error(
          `[IpSync] ✗ Not bound after sync: ${result.ip} - requests from this IP will fail with "Cannot assign requested address"`
        );
      }
    }
  }

  private async _getAssignedIps(): Promise<Set<string> | null> {
    if (this._isWindows) {
      return null;
    }

    try {
      const command = new Deno.Command('ip', {
        args: ['-o', 'addr', 'show'],
      });
      const result = await command.output();

      if (!result.success) {
        return null;
      }

      const output = new TextDecoder().decode(result.stdout);
      const assignedIps = new Set<string>();
      const addressRegex = /inet6?\s+([^\s/]+)/g;
      let match;

      while ((match = addressRegex.exec(output)) !== null) {
        assignedIps.add(match[1]);
      }

      return assignedIps;
    } catch (err) {
      console.error('[IpSync] Failed to read assigned addresses:', err);
      return null;
    }
  }
}
