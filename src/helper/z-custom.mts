import z from "zod";
import { Buffer } from "node:buffer";
export const z_buffer = z.custom<Buffer>((data) => Buffer.isBuffer(data));
export type ZodUrl = `http://${string}` | `https://${string}` | (string & {});
export const z_url = z.custom<ZodUrl>((data) => {
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
