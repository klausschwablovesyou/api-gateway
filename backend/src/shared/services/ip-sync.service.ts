import { Injectable } from '@danet/core';
import { IpRepository } from '../repositories/ip.repository.ts';

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

  async addIpToNetwork(ip: string): Promise<boolean> {
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
      return false;
    }
  }

  private _getGateway(ip: string): string {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
  }

  private _getTableId(ip: string): number {
    const parts = ip.split('.').map(Number);
    return parts[2] * 256 + parts[3];
  }

  private async _runIpCommand(args: string[]): Promise<{ success: boolean; stderr: string }> {
    const command = new Deno.Command('ip', { args });
    const result = await command.output();
    return {
      success: result.success,
      stderr: new TextDecoder().decode(result.stderr),
    };
  }

  private async _addIpLinux(ip: string, networkInterface: string): Promise<boolean> {
    const addrResult = await this._runIpCommand(['addr', 'add', `${ip}/32`, 'dev', networkInterface]);

    if (!addrResult.success) {
      if (addrResult.stderr.includes('RTNETLINK answers: File exists') || addrResult.stderr.includes('Address already assigned')) {
        console.log(`[IpSync] ✓ Already exists: ${ip}`);
      } else {
        console.error(`[IpSync] ✗ Failed to add: ${ip} - ${addrResult.stderr.trim()}`);
        return false;
      }
    } else {
      console.log(`[IpSync] ✓ Added: ${ip}`);
    }

    const gateway = this._getGateway(ip);
    const tableId = this._getTableId(ip);

    const routeResult = await this._runIpCommand(['route', 'add', 'default', 'via', gateway, 'src', ip, 'table', String(tableId)]);
    if (!routeResult.success && !routeResult.stderr.includes('File exists')) {
      console.error(`[IpSync] ✗ Failed to add route for ${ip}: ${routeResult.stderr.trim()}`);
      return false;
    }

    const ruleResult = await this._runIpCommand(['rule', 'add', 'from', ip, 'table', String(tableId)]);
    if (!ruleResult.success && !ruleResult.stderr.includes('File exists')) {
      console.error(`[IpSync] ✗ Failed to add rule for ${ip}: ${ruleResult.stderr.trim()}`);
      return false;
    }

    console.log(`[IpSync] ✓ Policy routing set: ${ip} via ${gateway} (table ${tableId})`);
    return true;
  }

  private async _addIpWindows(ip: string, networkInterface: string): Promise<boolean> {
    const command = new Deno.Command('netsh', {
      args: ['interface', 'ip', 'add', 'address', networkInterface, ip, '255.255.255.255'],
    });
    const result = await command.output();

    if (result.success) {
      console.log(`[IpSync] ✓ Added: ${ip}`);
      return true;
    } else {
      const stderr = new TextDecoder().decode(result.stderr);
      if (stderr.includes('already been configured') || stderr.includes('Object already exists')) {
        console.log(`[IpSync] ✓ Already exists: ${ip}`);
        return true;
      } else {
        console.error(`[IpSync] ✗ Failed to add: ${ip} - ${stderr.trim()}`);
        return false;
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
    const gateway = this._getGateway(ip);
    const tableId = this._getTableId(ip);

    await this._runIpCommand(['rule', 'del', 'from', ip, 'table', String(tableId)]);
    await this._runIpCommand(['route', 'del', 'default', 'via', gateway, 'src', ip, 'table', String(tableId)]);

    const addrResult = await this._runIpCommand(['addr', 'del', `${ip}/32`, 'dev', networkInterface]);

    if (addrResult.success) {
      console.log(`[IpSync] ✓ Removed: ${ip}`);
      return true;
    } else {
      if (addrResult.stderr.includes('Cannot assign requested address')) {
        console.log(`[IpSync] ✓ Already removed: ${ip}`);
        return true;
      } else {
        console.error(`[IpSync] ✗ Failed to remove: ${ip} - ${addrResult.stderr.trim()}`);
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
