import z from "zod";
import { z_buffer } from "../helper/z-custom.mts";

export const $DnsRecord = z.object({
  mode: z.enum(["http"]),
  hostname: z.string(),
  port: z.number(),
  publicKey: z_buffer,
  address: z.string(),
});
export type DnsRecord = typeof $DnsRecord._type; //

export const dnsTable = new Map<string, DnsRecord>();
