import type { DnsAddressRecord, DnsRecord } from "../helper/dns-record.mts";

export interface DnsDB {
  dnsTable: DnsTable;
  addressTable: AddressTable;
}

export interface CommonKeyValueStorage<K, V> {
  has(key: K): Promise<boolean>;
  get(key: K): Promise<V | undefined>;
  set(key: K, value: V): Promise<boolean>;
  delete(key: K): Promise<boolean>;
}

export type DnsTable = CommonKeyValueStorage<string, DnsRecord>;
export type AddressTable = CommonKeyValueStorage<string, DnsAddressRecord>;

export const createMemoryDnsDb = (): DnsDB => {
  class MemoryKeyValueStorage<K, V> implements CommonKeyValueStorage<K, V> {
    #data = new Map<K, V>();
    async has(key: K): Promise<boolean> {
      return this.#data.has(key);
    }
    async get(key: K): Promise<V | undefined> {
      return this.#data.get(key);
    }
    async set(key: K, value: V): Promise<boolean> {
      this.#data.set(key, value);
      return true;
    }
    async delete(key: K): Promise<boolean> {
      return this.#data.delete(key);
    }
  }
  return {
    dnsTable: new MemoryKeyValueStorage(),
    addressTable: new MemoryKeyValueStorage(),
  };
};
