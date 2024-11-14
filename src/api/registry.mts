import http from "node:http";
import z from "zod";
import { dnsTable } from "./dns-table.mts";

import { authRequestWithBody } from "../helper/auth-request.mts";
import { ResponseError } from "../helper/response-error.mts";
import { safeBufferFrom } from "../helper/safe-buffer-code.mts";

export const $RegistryInfo = z.object({
  auth: z.union([
    z.object({
      algorithm: z.enum(["bioforestchain"]),
      publicKey: z.string(),
    }),
    z.object({
      algorithm: z.enum(["web3"]),
      publicKey: z.string(),
    }),
  ]),
  service: z.union([
    z.object({
      mode: z.enum(["http"]),
      hostname: z.string().nullish(),
      port: z.number(),
    }),
    z.object({
      mode: z.enum(["vm"]),
      type: z.enum([
        // 单文件
        "script",
        // esm 模块标准
        "module",
      ]),
      href: z.string(),
    }),
  ]),
});
export type RegistryInfo = typeof $RegistryInfo._type;
export const registry = async (
  gateway: { hostname: string; port: number },
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const { rawBody, from_hostname, publicKey } = await authRequestWithBody(
    req,
    res
  );

  const registryInfo = $RegistryInfo.parse(
    JSON.parse(rawBody.toString("utf-8"))
  );
  if (registryInfo.auth.algorithm !== "bioforestchain") {
    throw new ResponseError(
      500,
      `No support '${registryInfo.auth.algorithm}' auth yet.`
    ).end(res);
  }
  if (registryInfo.service.mode !== "http") {
    throw new ResponseError(
      500,
      `No support '${registryInfo.service.mode}' service yet.`
    ).end(res);
  }
  /// 公钥要一致
  if (false === publicKey.equals(safeBufferFrom(registryInfo.auth.publicKey))) {
    throw new ResponseError(403, `fail to registry, publicKey no match.`).end(
      res
    );
  }
  // /// 发起域名要和注册的域名一致
  // if (from_hostname !== registryInfo.service.hostname) {
  //   throw new ResponseError(403, "fail to registry, hostname no match.").end(
  //     res
  //   );
  // }
  /// 注册的域名要归属于网关
  let hostname_suffix: string;
  if (gateway.hostname.endsWith(".local")) {
    hostname_suffix = `-${gateway.hostname}`;
  } else {
    hostname_suffix = `.${gateway.hostname}`;
  }
  if (false === from_hostname.endsWith(hostname_suffix)) {
    throw new ResponseError(
      403,
      "fail to registry, hostname no belongs to gateway."
    ).end(res);
  }

  dnsTable.set(from_hostname, {
    ...registryInfo.service,
    hostname: registryInfo.service.hostname ?? "127.0.0.1",
  });

  const registry_host = `${from_hostname}:${gateway.port}`;
  console.log("registry host:", registry_host);
  res.end(registry_host);
};
