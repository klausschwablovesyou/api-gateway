import { RequestData } from "./request-data";

export class GetBlobRequestData extends RequestData {
  constructor(init?: GetBlobRequestData) {
    super();
    Object.assign(this, init);
  }
}
