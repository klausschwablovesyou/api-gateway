import { GetRequestData } from "./get-request-data";

export class DeleteRequestData extends GetRequestData {
  public requestBody?: object | string;
  constructor(init?: DeleteRequestData) {
    super();
    Object.assign(this, init);
  }
}
