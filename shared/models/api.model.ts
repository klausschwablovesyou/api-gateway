import { HttpMethod } from '@shared/types/http-method';
import { RequestLimitUnit } from '@shared/types/request-limit-unit';

export class Api {
  public id!: string;
  public name!: string;
  public apiUrl!: string;
  public method!: HttpMethod;
  public publicKey!: string;
  public privateKey!: string;
  public requestLimit!: number;
  public requestLimitUnit!: RequestLimitUnit;

  public constructor(init?: Partial<Api>) {
    Object.assign(this, init);
  }
}
