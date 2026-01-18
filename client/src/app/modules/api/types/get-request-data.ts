import { RequestData } from "./request-data";

export class GetRequestData extends RequestData {

  constructor(init?: GetRequestData) {
    super();
    Object.assign(this, init);
  }
}
