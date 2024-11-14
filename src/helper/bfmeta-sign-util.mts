import crypto from "node:crypto";

import { Buffer } from "node:buffer";

import { BFMetaSignUtil } from "@bfmeta/sign-util";

class CryptoHelper {
  async sha256(msg: Uint8Array | string) {
    if (msg instanceof Uint8Array) {
      return crypto.createHash("sha256").update(msg).digest();
    }
    return crypto
      .createHash("sha256")
      .update(new Uint8Array(Buffer.from(msg)))
      .digest();
  }

  async md5(data?: Uint8Array) {
    const hash = crypto.createHash("md5");
    if (data) {
      return hash.update(data).digest();
    }
    return hash;
  }

  async ripemd160(data?: Uint8Array) {
    const hash = crypto.createHash("ripemd160");
    if (data) {
      return hash.update(data).digest();
    }
    return hash;
  }
}

export const bfmetaSignUtil = new BFMetaSignUtil(
  "",
  Buffer as any,
  new CryptoHelper() as any
);
