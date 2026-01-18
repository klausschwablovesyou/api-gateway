import { ResponseMessageException } from "@app/modules/api/types/response-message-exception";

export const apiMessageExceptions: ResponseMessageException[] = [{
  statusCode: 401,
  url: '/login'
}];
