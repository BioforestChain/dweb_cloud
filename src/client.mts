import { Buffer } from "node:buffer";
import z from "zod";
import type { RegistryInfo } from "./api/registry.mts";
import { signRequest, verifyRequest } from "./helper/auth-request.mts";
import { bfmetaSignUtil } from "./helper/bfmeta-sign-util.mts";
import { type DnsRecord, dnsRecordParser } from "./helper/dns-record.mts";
import type { ZodBuffer, ZodUrl } from "./helper/mod.mts";
import { toSafeBuffer } from "./helper/safe-buffer-code.mts";
import { z_buffer, z_url } from "./helper/z-custom.mts";
import type { PromiseMaybe } from "@gaubee/util";
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
  args: RegistryArgs,
): Promise<{
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: Buffer;
  info: RegistryInfo;
  fetchRegistry: (customFetch?: typeof fetch) => Promise<Response>;
  parseRegistry: (res?: PromiseMaybe<Response>) => Promise<DnsRecord>;
}> => {
  $RegistryArgs.parse(args);
  const { gateway, keypair: keypair_or_secret } = args;
  const keypair = typeof keypair_or_secret === "string"
    ? await createBioforestChainKeypairBySecretKeyString(keypair_or_secret)
    : keypair_or_secret;
  const gateway_url = new URL(gateway);
  const { hostname: gateway_hostname } = gateway_url;

  const address = await bfmetaSignUtil.getAddressFromPublicKey(
    keypair.publicKey,
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
    body,
  );
  const fetchRegistry = (customFetch = fetch) =>
    customFetch(api_url, {
      method: method,
      headers: headers,
      body: body,
    });
  const parseRegistry = async (
    res: PromiseMaybe<Response> = fetchRegistry(),
  ) => {
    res = await res;
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
    fetchRegistry,
    parseRegistry,
  };
};

export const createBioforestChainKeypairBySecretKeyString = async (
  secret: string,
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
        keypair.publicKey as Buffer,
      );
    },
  };
};

export const createBioforestChainAddressByPublicKey = (
  publicKey: Buffer,
): Promise<string> => {
  return bfmetaSignUtil.getAddressFromPublicKey(publicKey as Buffer);
};

export const queryDnsRecord: (
  gateway_origin: string | URL,
  search: {
    hostname: string;
  } | {
    address: string;
  },
) => {
  gateway_url: URL;
  fetchDnsRecord: (customFetch?: typeof fetch) => Promise<Response>;
  parseDnsRecord: (res?: Response | Promise<Response>) => Promise<DnsRecord>;
} = (
  gateway_origin: string | URL,
  search: { hostname: string } | { address: string },
) => {
  const gateway_url = new URL(gateway_origin);
  gateway_url.pathname = "/query";
  for (const key in search) {
    gateway_url.searchParams.set(key, search[key as keyof typeof search]);
  }

  const fetchDnsRecord = (customFetch = fetch) => customFetch(gateway_url);
  const parseDnsRecord = async (
    res: PromiseMaybe<Response> = fetchDnsRecord(),
  ) => {
    res = await res;
    if (false === res.ok) {
      throw new Error(`[${res.status}] ${res.statusText}`);
    }
    return dnsRecordParser(await res.text());
  };
  return {
    gateway_url,
    fetchDnsRecord,
    parseDnsRecord,
  };
};
