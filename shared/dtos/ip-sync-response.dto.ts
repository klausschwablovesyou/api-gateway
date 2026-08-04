import { IpSyncResultDto } from '@shared/dtos/ip-sync-result.dto';

export type IpSyncResponseDto = {
  networkInterface: string;
  total: number;
  succeeded: number;
  failed: number;
  results: IpSyncResultDto[];
};
