import z from "zod";

export const $DnsRecord = z.object({
  mode: z.enum(["http"]),
  hostname: z.string(),
  port: z.number(),
});
export type DnsRecord = typeof $DnsRecord._type; //

export const dnsTable = new Map<string, DnsRecord>();
