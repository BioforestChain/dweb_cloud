import { Buffer } from "node:buffer";
import { z } from "zod";
import { safeBufferFrom, toSafeBuffer } from "./safe-buffer-code.mts";
import { z_buffer, type ZodBuffer } from "./z-custom.mts";

export const $DnsRecord: z.ZodObject<{
  mode: z.ZodLiteral<"http">;
  origin: z.ZodString;
  hostname: z.ZodString;
  lookupHostname: z.ZodString;
  address: z.ZodString;
  family: z.ZodUnion<[z.ZodLiteral<4>, z.ZodLiteral<6>]>;
  port: z.ZodNumber;
  publicKey: ZodBuffer;
  peerAddress: z.ZodString;
}> = z.object({
  mode: z.literal("http"),
  origin: z.string(),
  hostname: z.string(),
  lookupHostname: z.string(),
  address: z.string(),
  family: z.union([z.literal(4), z.literal(6)]),
  port: z.number(),
  publicKey: z_buffer,
  peerAddress: z.string(),
});
export type DnsRecord = typeof $DnsRecord._type; //

export const $DnsAddressRecord: z.ZodObject<{
  mode: z.ZodLiteral<"address">;
  hostname: z.ZodString;
}> = z.object({
  mode: z.literal("address"),
  hostname: z.string(),
});
export type DnsAddressRecord = typeof $DnsAddressRecord._type; //

export const dnsRecordReplacer: (key: string, value: unknown) => unknown = (
  _key,
  value
) => {
  if (Buffer.isBuffer(value)) {
    return toSafeBuffer(value, "hex");
  }
  return value;
};
export const dnsRecordReviver: (key: string, value: unknown) => unknown = (
  key,
  value
) => {
  if (key === "publicKey") {
    return safeBufferFrom(value as string);
  }
  return value;
};
