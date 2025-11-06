import type { Buffer } from "node:buffer";
import { z } from "zod";
import { safeBufferFrom, toSafeBuffer } from "./safe-buffer-code.mts";
import { z_buffer, type ZodBuffer } from "./z-custom.mts";

export const $DnsRecordLookup: z.ZodObject<{
  address: z.ZodString;
  family: z.ZodUnion<[z.ZodLiteral<4>, z.ZodLiteral<6>]>;
  ttl: z.ZodNumber;
}> = z.object({
  address: z.string(),
  family: z.union([z.literal(4), z.literal(6)]),
  ttl: z.number(),
});
export type DnsRecordLookup = z.TypeOf<typeof $DnsRecordLookup>; //
export const $DnsRecord: z.ZodObject<{
  mode: z.ZodLiteral<"http">;
  origin: z.ZodString;
  hostname: z.ZodString;
  port: z.ZodNumber;
  lookupHostname: z.ZodString;
  lookup: z.ZodOptional<typeof $DnsRecordLookup>;
  publicKey: ZodBuffer;
  peerAddress: z.ZodString;
}> = z.object({
  mode: z.literal("http"),
  origin: z.string(),
  hostname: z.string(),
  port: z.number(),
  lookupHostname: z.string(),
  lookup: $DnsRecordLookup.optional(),
  publicKey: z_buffer,
  peerAddress: z.string(),
});
export type DnsRecord = z.TypeOf<typeof $DnsRecord>; //

export const $DnsAddressRecord: z.ZodObject<{
  mode: z.ZodLiteral<"address">;
  hostname: z.ZodString;
}> = z.object({
  mode: z.literal("address"),
  hostname: z.string(),
});
export type DnsAddressRecord = z.TypeOf<typeof $DnsAddressRecord>; //

export const dnsRecordStringify: (data: DnsRecord) => string = (data) => {
  const json = JSON.stringify(
    {
      ...data,
      publicKey: data.publicKey.toString("hex"),
    },
    (key, value) => {
      if (key === "publicKey") {
        return toSafeBuffer(value as Buffer, "hex");
      }
      return value;
    },
  );
  return json;
};
export const dnsRecordParser: (data: string) => DnsRecord = (data) => {
  return JSON.parse(data, (key, value) => {
    if (key === "publicKey") {
      return safeBufferFrom(value as string);
    }
    return value;
  });
};
