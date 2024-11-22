import { z } from "zod";
import { z_buffer, type ZodBuffer } from "../helper/z-custom.mts";

export const $DnsRecord: z.ZodObject<{
  mode: z.ZodLiteral<"http">;
  hostname: z.ZodString;
  lookupHostname: z.ZodString;
  address: z.ZodString;
  family: z.ZodUnion<[z.ZodLiteral<4>, z.ZodLiteral<6>]>;
  port: z.ZodNumber;
  publicKey: ZodBuffer;
  peerAddress: z.ZodString;
}> = z.object({
  mode: z.literal("http"),
  hostname: z.string(),
  lookupHostname: z.string(),
  address: z.string(),
  family: z.union([z.literal(4), z.literal(6)]),
  port: z.number(),
  publicKey: z_buffer,
  peerAddress: z.string(),
});
export type DnsRecord = typeof $DnsRecord._type; //

export const dnsTable = new Map<string, DnsRecord>();

export const $DnsAddressRecord: z.ZodObject<{
  mode: z.ZodLiteral<"address">;
  hostname: z.ZodString;
}> = z.object({
  mode: z.literal("address"),
  hostname: z.string(),
});
export type DnsAddressRecord = typeof $DnsAddressRecord._type; //
export const dnsAddressTable = new Map<string, DnsAddressRecord>();
