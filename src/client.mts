import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { bfmetaSignUtil } from "./helper/bfmeta-sign-util.mts";
import z from "zod";
import { z_buffer, z_url } from "./helper/z-custom.mts";
import type { RegistryInfo } from "./api/registry.mts";
import { toSafeBuffer } from "./helper/safe-buffer-code.mts";
export const $RegistryArgs = z.object({
  gateway: z_url,
  keypair: z.union([
    z.string(),
    z.object({ privateKey: z_buffer, publicKey: z_buffer }),
  ]),
  algorithm: z.enum(["bioforestchain"]),
  service: z.object({
    mode: z.enum(["http"]),
    port: z.number(),
  }),
});
export type RegistryArgs = typeof $RegistryArgs._type;
export const registry = async (args: RegistryArgs) => {
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
  const info = {
    auth: {
      algorithm: args.algorithm,
      publicKey: toSafeBuffer(keypair.publicKey),
    },
    service: {
      mode: "http",
      hostname: (gateway_hostname.endsWith(".local")
        ? `${address}-${gateway_hostname}`
        : `${address}.${gateway_hostname}`).toLowerCase(),
      port: args.service.port,
    },
  } satisfies RegistryInfo;
  const body = Buffer.from(JSON.stringify(info, null, 2));
  const api_url = gateway_url;
  api_url.pathname = "/registry";
  const method = "POST";
  const headers = await signRequestWithBody(
    keypair,
    info.service.hostname,
    api_url,
    method,
    body
  );
  return {
    url: api_url,
    method,
    headers,
    body,
    info,
  };
};

export const signRequestWithBody = async (
  keypair: Keypair,
  from_hostname: string,
  api_url: URL,
  method: string,
  body: Buffer
) => {
  const headers: Record<string, string> = {};
  const { hostname: to_hostname, pathname, search } = api_url;
  headers["x-dweb-cloud-host"] = to_hostname;
  headers["x-dweb-cloud-origin"] = `${api_url.protocol}//${from_hostname}`;
  const signMsg = Buffer.concat([
    Buffer.from(
      [
        /// METHOD + URL
        method.toUpperCase() + " " + pathname + search,
        /// HEAD
        `ALGORITHM bioforestchain`,
        `FROM ${from_hostname}`,
        `TO ${to_hostname}`,
      ].join("\n") + "\n"
    ),
    body,
  ]);

  const signature = await bfmetaSignUtil.detachedSign(
    signMsg,
    keypair.privateKey
  );
  headers["x-dweb-cloud-algorithm"] = "bioforestchain";
  headers["x-dweb-cloud-public-key"] = toSafeBuffer(keypair.publicKey);
  headers["x-dweb-cloud-signature"] = toSafeBuffer(signature as Buffer);

  console.log("signMsg", signMsg.toString());
  console.log("signature", signature.toString("hex"));
  console.log("publicKey", keypair.publicKey.toString("hex"));
  return headers;
};

export type Keypair = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const createBioforestChainKeypairBySecretKeyString = async (
  secret: string
) => {
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
