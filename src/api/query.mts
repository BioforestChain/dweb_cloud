import type http from "node:http";
import { z } from "zod";
import { dnsRecordStringify } from "../helper/dns-record.mts";
import { ResponseError } from "../helper/response-error.mts";
import { responseJson } from "../helper/response-success.mts";
import type { DnsDB } from "./dns-table.mts";
export const query = async (
  db: DnsDB,
  qs: URLSearchParams,
  _req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  const address = z.string().nullable().parse(qs.get("address"));
  const addressInfo = address ? await db.addressTable.get(address) : undefined;

  const hostname =
    addressInfo?.hostname ??
    z.string({ error: "required params hostname" }).parse(qs.get("hostname"));

  const info = await db.dnsTable.get(hostname);

  if (info == null) {
    throw new ResponseError(
      404,
      `no found dns record for hostname:${hostname}`,
    ).end(res);
  }
  responseJson(res, info, dnsRecordStringify);
};
