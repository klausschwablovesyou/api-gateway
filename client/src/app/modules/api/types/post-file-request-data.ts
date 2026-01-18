import { PostRequestData } from "./post-request-data";

export class PostFileRequestData extends PostRequestData {
  public file!: File;
  public fileFormName? = 'file';

  constructor(init?: PostFileRequestData) {
    super();
    Object.assign(this, init);
  }
}
