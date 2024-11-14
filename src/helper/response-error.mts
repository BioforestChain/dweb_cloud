import http from "node:http";
export class ResponseError extends Error {
  constructor(readonly code: number, message: string, options?: ErrorOptions) {
    super(message, options);
  }
  end(res: http.ServerResponse) {
    res.statusCode = this.code;
    res.end(this.stack || this.message);
    return this;
  }
}
