import { Buffer } from "node:buffer";
import z from "zod";
import type { RegistryInfo } from "./api/registry.mts";
import { signRequest, verifyRequest } from "./helper/auth-request.mts";
import { bfmetaSignUtil } from "./helper/bfmeta-sign-util.mts";
import { dnsRecordParser, type DnsRecord } from "./helper/dns-record.mts";
import type { ZodBuffer, ZodUrl } from "./helper/mod.mts";
import { toSafeBuffer } from "./helper/safe-buffer-code.mts";
import { z_buffer, z_url } from "./helper/z-custom.mts";
export type { DnsRecord };
export const $RegistryArgs: z.ZodObject<{
  gateway: ZodUrl;
  keypair: z.ZodUnion<
    [z.ZodString, z.ZodObject<{ privateKey: ZodBuffer; publicKey: ZodBuffer }>]
  >;
  algorithm: z.ZodEnum<["bioforestchain"]>;
  service: z.ZodObject<{
    mode: z.ZodEnum<["http"]>;
    hostname: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    port: z.ZodNumber;
  }>;
}> = z.object({
  gateway: z_url,
  keypair: z.union([
    z.string(),
    z.object({ privateKey: z_buffer, publicKey: z_buffer }),
  ]),
  algorithm: z.enum(["bioforestchain"]),
  service: z.object({
    mode: z.enum(["http"]),
    hostname: z.string().nullish(),
    port: z.number(),
  }),
});
export type RegistryArgs = typeof $RegistryArgs._type;
/**
 * 注册接口
 * @param args
 * @returns
 */
export const registry = async (
  args: RegistryArgs
): Promise<{
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: Buffer;
  info: RegistryInfo;
  request: () => Promise<DnsRecord>;
}> => {
  $RegistryArgs.parse(args);
  const { gateway, keypair: keypair_or_secret } = args;
  const keypair =
    typeof keypair_or_secret === "string"
      ? await createBioforestChainKeypairBySecretKeyString(keypair_or_secret)
      : keypair_or_secret;
  const gateway_url = new URL(gateway);
  const { hostname: gateway_hostname } = gateway_url;

  const address = await bfmetaSignUtil.getAddressFromPublicKey(
    keypair.publicKey
  );
  const my_hostname = (
    gateway_hostname.endsWith(".local")
      ? `${address}-${gateway_hostname}`
      : `${address}.${gateway_hostname}`
  ).toLowerCase();
  const info = {
    auth: {
      algorithm: args.algorithm,
      publicKey: toSafeBuffer(keypair.publicKey),
    },
    service: {
      mode: "http",
      hostname: args.service.hostname,
      port: args.service.port,
    },
  } satisfies RegistryInfo;
  const body = Buffer.from(JSON.stringify(info, null, 2));
  const api_url = gateway_url;
  api_url.pathname = "/registry";
  const method = "POST";
  const headers = await signRequest(
    keypair,
    my_hostname,
    api_url,
    method,
    body
  );
  const request = async () => {
    const res = await fetch(api_url, {
      method: method,
      headers: headers,
      body: body,
    });
    if (!res.ok) {
      throw new Error(`[${res.status}] ${res.statusText}`);
    }
    return dnsRecordParser(await res.text());
  };
  return {
    url: api_url,
    method,
    headers,
    body,
    info,
    request,
  };
};

export const createBioforestChainKeypairBySecretKeyString = async (
  secret: string
): Promise<{
  privateKey: Buffer;
  publicKey: Buffer;
  readonly address: Promise<string>;
}> => {
  bfmetaSignUtil.createKeypairBySecretKeyString;
  const keypair = await bfmetaSignUtil.createKeypair(secret);
  return {
    privateKey: keypair.secretKey as Buffer,
    publicKey: keypair.publicKey as Buffer,
    get address() {
      return bfmetaSignUtil.getAddressFromPublicKey(
        keypair.publicKey as Buffer
      );
    },
  };
};

export const createBioforestChainAddressByPublicKey = (
  publicKey: Buffer
): Promise<string> => {
  return bfmetaSignUtil.getAddressFromPublicKey(publicKey as Buffer);
};

/** 查询接口 */
export const query = (
  req_url: string,
  req_method: string,
  req_headers: Headers,
  req_body: Uint8Array | undefined | (() => Promise<Uint8Array | undefined>),
  gateway_url: URL,
  self_hostname?: string
):
  | {
      api_url: URL;
      method: string;
      info: Omit<ReturnType<typeof verifyRequest>, "verify">;
      verify: () => Promise<boolean>;
      getDnsRecord: (res?: Response | Promise<Response>) => Promise<DnsRecord>;
    }
  | undefined => {
  /// 首先，算法协议是否支持
  if (req_headers.get("x-dweb-cloud-algorithm") !== "bioforestchain") {
    return;
  }
  const { verify, ...info } = verifyRequest(
    req_url,
    req_method,
    req_headers,
    req_body
  );
  /// 然后检查发送目标是不是自己
  if (self_hostname != null && info.to_hostname !== self_hostname) {
    return;
  }
  /// 接着检查发送着的信息
  const from_origin = req_headers.get("x-dweb-cloud-origin");
  if (from_origin == null) {
    return;
  }
  const { hostname: from_hostname } = new URL(from_origin);
  const api_url = new URL(gateway_url);
  api_url.pathname = "/query";
  api_url.searchParams.set("hostname", from_hostname);
  const method = "GET";

  const getDnsRecord = async (
    res: Response | Promise<Response> = fetch(api_url, { method })
  ) => {
    res = await res;
    if (false === res.ok) {
      throw new Error(`[${res.status}] ${res.statusText}`);
    }
    const dnsRecord: DnsRecord = dnsRecordParser(await res.text());
    if (false === dnsRecord.publicKey.equals(dnsRecord.publicKey)) {
      throw new Error("public key no match");
    }
    if (false === (await verify())) {
      throw new Error("fail to veriy");
    }
    return dnsRecord;
  };
  return {
    api_url,
    method,
    info,
    verify,
    getDnsRecord,
  };
};

export const queryDnsRecord: (
  gateway_origin: string | URL,
  search: { hostname: string } | { address: string }
) => Promise<DnsRecord> = async (
  gateway_origin: string | URL,
  search: { hostname: string } | { address: string }
) => {
  const gateway_url = new URL(gateway_origin);
  gateway_url.pathname = "/query";
  for (const key in search) {
    gateway_url.searchParams.set(key, search[key as keyof typeof search]);
  }
  const res = await fetch(gateway_url);
  if (res.ok === false) {
    throw new Error(`[${res.status}] ${res.statusText}`);
  }
  const dnsRecord: DnsRecord = dnsRecordParser(await res.text());
  return dnsRecord;
};
