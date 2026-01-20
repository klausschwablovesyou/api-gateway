import { HttpMethod } from '@shared/types/http-method';
import { RequestLimitUnit } from '@shared/types/request-limit-unit';

export type CreateApiDto = {
  name: string;
  apiUrl: string;
  method: HttpMethod;
  requestLimit: number;
  requestLimitUnit: RequestLimitUnit;
};
