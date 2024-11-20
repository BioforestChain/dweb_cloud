import z from "zod";
import { Buffer } from "node:buffer";
export type ZodBuffer = z.ZodType<Buffer>;
export const z_buffer: ZodBuffer = z.custom((data) => Buffer.isBuffer(data));
export type SafeUrlString =
  | `http://${string}`
  | `https://${string}`
  | (string & {});
export type ZodUrl = z.ZodType<SafeUrlString>;
export const z_url: ZodUrl = z.custom((data) => {
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
