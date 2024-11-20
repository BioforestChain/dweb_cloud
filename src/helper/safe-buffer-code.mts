import { Buffer } from "node:buffer";
export const safeBufferFrom = (data: string): Buffer => {
  if (data.startsWith("hex:")) {
    return Buffer.from(data.slice(4), "hex");
  }
  if (data.startsWith("base64:")) {
    return Buffer.from(data.slice(7), "base64");
  }
  if (data.startsWith("data:") && data.includes(";base64,")) {
    const index = data.indexOf(",");
    return Buffer.from(data.slice(index + 1), "base64url");
  }
  return Buffer.from(data);
};
export const toSafeBuffer = (
  buffer: Buffer,
  encoding?: "base64" | "hex",
): string => {
  if (encoding == null) {
    if (buffer.length <= 32) {
      encoding = "hex";
    }
  }
  if (encoding === "hex") {
    return `hex:${buffer.toString("hex")}`;
  }
  return `base64:${buffer.toString("base64")}`;
};
