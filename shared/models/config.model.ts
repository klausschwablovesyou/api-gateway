export class Config {
  public key!: string;
  public value!: string;

  public constructor(init?: Partial<Config>) {
    Object.assign(this, init);
  }
}
