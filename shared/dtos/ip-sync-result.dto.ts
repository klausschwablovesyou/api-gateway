import { IpSyncStatus } from '@shared/types/ip-sync-status';

export type IpSyncResultDto = {
  ip: string;
  status: IpSyncStatus;
  /** Whether the address is actually bound to an interface after the sync. Null if it could not be checked. */
  verified: boolean | null;
  error?: string;
};
