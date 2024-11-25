import { Buffer } from "node:buffer";
import type http from "node:http";
export const getNodeReqBody = async (
  req: http.IncomingMessage,
): Promise<Buffer | undefined> => {
  if (req.method === "GET" || req.method === "HEAD") {
    return;
  }
  if (req.headers["content-length"] !== "0") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
};
