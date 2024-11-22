import type { DnsRecord, DnsAddressRecord } from "../helper/dns-record.mts";

export const dnsTable = new Map<string, DnsRecord>();

export const dnsAddressTable = new Map<string, DnsAddressRecord>();
