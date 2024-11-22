import type http from "node:http";
import { Buffer } from "node:buffer";
import { dnsAddressTable, dnsTable } from "./dns-table.mts";
import { z } from "zod";
import { toSafeBuffer } from "../helper/safe-buffer-code.mts";
import { responseJson } from "../helper/response-success.mts";
export const query = (
  qs: URLSearchParams,
  _req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const address = z.string().optional().parse(qs.get("address"));
  const addressInfo = address ? dnsAddressTable.get(address) : undefined;

  const hostname =
    addressInfo?.hostname ??
    z
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
