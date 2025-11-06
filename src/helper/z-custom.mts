import z from "zod";
import { Buffer } from "node:buffer";
export type ZodBuffer = z.z.ZodCustom<Buffer>;
export const z_buffer: ZodBuffer = z.custom<Buffer>((data) =>
  Buffer.isBuffer(data),
);
export type SafeUrlString =
  | `http://${string}`
  | `https://${string}`
  | (string & {});
export type ZodUrl = z.ZodCustom<SafeUrlString>;
export const z_url: ZodUrl = z.custom<SafeUrlString>((data) => {
  if (typeof data !== "string") {
    return false;
  }
  if (data.startsWith("http://") || data.startsWith("https://")) {
    try {
      return new URL(data).href === data;
    } catch {
      return false;
    }
  }
  return false;
});
