import type http from "node:http";
import { z } from "zod";
import { responseJson } from "../helper/response-success.mts";
import { dnsAddressTable, dnsTable } from "./dns-table.mts";
import { dnsRecordStringify } from "../helper/dns-record.mts";
import { ResponseError } from "../helper/response-error.mts";
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

  if (info == null) {
    throw new ResponseError(
      404,
      `no found dns record for hostname:${hostname}`
    );
  }
  responseJson(res, info, dnsRecordStringify);
};
