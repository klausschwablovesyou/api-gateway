export class RequestLog {
  public id!: string;
  public apiId!: string | null;
  public ipId!: string | null;
  public errorMessage!: string;
  public statusCode!: number;
  public occurredAt!: number;

  public constructor(init?: Partial<RequestLog>) {
    Object.assign(this, init);
  }
}
