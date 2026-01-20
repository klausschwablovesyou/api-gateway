export class IpUsage {
  public id!: string;
  public ipId!: string;
  public apiId!: string;
  public lastUsedAt!: number;
  public requestLimitCounter!: number;

  public constructor(init?: Partial<IpUsage>) {
    Object.assign(this, init);
  }
}
