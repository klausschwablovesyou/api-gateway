export class Ip {
  public id!: string;
  public ip!: string;

  public constructor(init?: Partial<Ip>) {
    Object.assign(this, init);
  }
}
