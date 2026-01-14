declare module "express-request-id" {
  import type { RequestHandler } from "express";
  const requestId: () => RequestHandler;
  export default requestId;
}
