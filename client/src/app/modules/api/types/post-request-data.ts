import { RequestData } from "./request-data";

export class PostRequestData extends RequestData {
  public requestBody?: object | string;

  constructor(init?: PostRequestData) {
    super();
    Object.assign(this, init);
  }
}
