import dns from "node:dns";
import type http from "node:http";
import z from "zod";
import type { DnsDB } from "./dns-table.mts";

import { authRequestWithBody } from "../helper/auth-request.mts";
import {
  type DnsRecord,
  type DnsRecordLookup,
  dnsRecordStringify,
} from "../helper/dns-record.mts";
import { ResponseError } from "../helper/response-error.mts";
import { responseJson } from "../helper/response-success.mts";
import { safeBufferFrom } from "../helper/safe-buffer-code.mts";
import { z_buffer } from "../helper/z-custom.mts";
import { map_get_or_put_async } from "@gaubee/util";
import { onIdea } from "../helper/on-idea.mts";
export const $RegistryInfo: z.ZodObject<{
  auth: z.ZodUnion<
    [
      z.ZodObject<{
        algorithm: z.ZodEnum<["bioforestchain"]>;
        publicKey: z.ZodString;
      }>,
      z.ZodObject<{
        algorithm: z.ZodEnum<["web3"]>;
        publicKey: z.ZodString;
      }>,
    ]
  >;
  service: z.ZodUnion<
    [
      z.ZodObject<{
        mode: z.ZodEnum<["http"]>;
        hostname: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        port: z.ZodNumber;
      }>,
      z.ZodObject<{
        mode: z.ZodEnum<["vm"]>;
        type: z.ZodEnum<["script", "module"]>;
        href: z.ZodString;
      }>,
    ]
  >;
}> = z.object({
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
export type GatewayConfig = {
  protocol: string;
  hostname: string;
  sep: string;
  port: number;
};
export const registry = async (
  db: DnsDB,
  gateway: GatewayConfig,
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  const { rawBody, from_hostname, publicKey, address } =
    await authRequestWithBody(req, res);

  const registryInfo = $RegistryInfo.parse(
    JSON.parse(z_buffer.parse(rawBody).toString("utf-8")),
  );
  if (registryInfo.auth.algorithm !== "bioforestchain") {
    throw new ResponseError(
      500,
      `No support '${registryInfo.auth.algorithm}' auth yet.`,
    ).end(res);
  }
  if (registryInfo.service.mode !== "http") {
    throw new ResponseError(
      500,
      `No support '${registryInfo.service.mode}' service yet.`,
    ).end(res);
  }
  /// 公钥要一致
  if (
    false ===
    publicKey.equals(safeBufferFrom(registryInfo.auth.publicKey) as Uint8Array)
  ) {
    throw new ResponseError(403, `fail to registry, publicKey no match.`).end(
      res,
    );
  }
  // /// 发起域名要和注册的域名一致
  // if (from_hostname !== registryInfo.service.hostname) {
  //   throw new ResponseError(403, "fail to registry, hostname no match.").end(
  //     res
  //   );
  // }
  /// 注册的域名要归属于网关
  const hostname_suffix = gateway.sep + gateway.hostname;
  if (false === from_hostname.endsWith(hostname_suffix)) {
    throw new ResponseError(
      403,
      "fail to registry, hostname no belongs to gateway.",
    ).end(res);
  }

  /// 这里的自定义 hostname 只是用来 dns lookup 查询ip，并不作为记录值
  const lookupHostname = registryInfo.service.hostname ?? from_hostname;
  const registry_origin = `${gateway.protocol}//${from_hostname}:${gateway.port}`;
  const dnsRecord: DnsRecord = {
    ...registryInfo.service,
    origin: registry_origin,
    hostname: from_hostname,
    lookupHostname: lookupHostname,
    lookup: undefined,
    publicKey: publicKey,
    peerAddress: address,
  };
  dnsRecordByHostnameCache.get(from_hostname)?.clearLookupLoop();
  await db.dnsTable.set(from_hostname, dnsRecord);

  await db.addressTable.set(address, {
    mode: "address",
    hostname: from_hostname,
  });

  return responseJson(res, dnsRecord, dnsRecordStringify);
};
const IPV4_REGEXP =
  /(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/;
const dnsLookup = async (
  gateway: GatewayConfig,
  lookupHostname: string,
): Promise<DnsRecordLookup> => {
  if (IPV4_REGEXP.test(lookupHostname)) {
    return {
      address: lookupHostname,
      family: 4,
      ttl: Infinity,
    };
  }
  const hostname_suffix = gateway.sep + gateway.hostname;
  if (lookupHostname.endsWith(hostname_suffix)) {
    return {
      address: "127.0.0.1",
      family: 4,
      ttl: Infinity,
    };
  }
  const lookupResult = await dns.promises.lookup(lookupHostname);
  return {
    address: lookupResult.address,
    family: lookupResult.family,
    ttl: Date.now() + 600e10,
  } as DnsRecordLookup;
};

const dnsRecordByHostnameCache = new Map<
  string,
  Readonly<{
    dnsRecord: DnsRecord;
    lookup: DnsRecordLookup;
    clearLookupLoop: () => void;
  }>
>();
const CLEAR_THRESHOLD = 1200;
const SAFE_CACHE_SIZE = 800;
export const fastDnsRecordByHostname = async (
  db: DnsDB,
  gateway: GatewayConfig,
  hostname: string,
) => {
  const cache = await map_get_or_put_async(
    dnsRecordByHostnameCache,
    hostname,
    async () => {
      const dnsRecord = await db.dnsTable.get(hostname);
      if (dnsRecord == null) {
        throw new Error(`no found dnsRecord by hostname: ${hostname}`);
      }
      let currentLookup =
        dnsRecord.lookup ??
        (await dnsLookup(gateway, dnsRecord.lookupHostname));

      const updateLookup = async () => {
        dnsRecord.lookup = currentLookup = await dnsLookup(gateway, hostname);
        await db.dnsTable.set(hostname, dnsRecord);
        // 缓存更新了，将数据挪到尾部
        dnsRecordByHostnameCache.delete(hostname);
        dnsRecordByHostnameCache.set(hostname, cache);
      };
      let ti: number | undefined;
      const startLookupLoop = async () => {
        const diffTime = currentLookup.ttl - Date.now();
        if (diffTime > 0 && Number.isSafeInteger(diffTime)) {
          ti = setTimeout(() => {
            ti = undefined;
            if (useLookupDirty) {
              useLookupDirty = false;
              void startLookupLoop();
            }
          }, diffTime);
        } else if (diffTime < 0) {
          await updateLookup();
        }
      };

      const clearLookupLoop = () => {
        dnsRecordByHostnameCache.delete(hostname);
        if (ti != null) {
          clearInterval(ti);
        }
      };
      let useLookupDirty = false;
      const cache = {
        dnsRecord,
        get lookup() {
          useLookupDirty = true;
          return currentLookup;
        },
        clearLookupLoop,
      };
      return cache;
    },
  );
  return cache;
};

/// 启动清理工具
onIdea(() => {
  if (dnsRecordByHostnameCache.size > CLEAR_THRESHOLD) {
    for (const key of dnsRecordByHostnameCache.keys()) {
      if (dnsRecordByHostnameCache.size <= SAFE_CACHE_SIZE) {
        break;
      }
      dnsRecordByHostnameCache.delete(key);
    }
  }
});
