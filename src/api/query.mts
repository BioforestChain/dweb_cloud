import type http from "node:http";
import { Buffer } from "node:buffer";
import { dnsTable } from "./dns-table.mts";
import { z } from "zod";
import { toSafeBuffer } from "src/helper/safe-buffer-code.mts";
import { responseJson } from "src/helper/response-success.mts";
export const query = (
  qs: URLSearchParams,
  _req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  const hostname = z
    .string({ required_error: "required params hostname" })
    .parse(qs.get("hostname"));
  const info = dnsTable.get(hostname);

  responseJson(res, info, (_, v) => {
    if (Buffer.isBuffer(v)) {
      return toSafeBuffer(v, "hex");
    }
    return v;
  });
};
