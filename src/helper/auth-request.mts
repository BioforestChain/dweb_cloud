import type http from "node:http";
import z from "zod";
import { getNodeReqBody } from "./income-message.mts";
import { Buffer } from "node:buffer";
import { safeBufferFrom, toSafeBuffer } from "./safe-buffer-code.mts";
import { bfmetaSignUtil } from "./bfmeta-sign-util.mts";
import { ResponseError } from "./response-error.mts";

export const signRequest = async (
  keypair: Keypair,
  origin_hostname: string,
  api_url: URL,
  method: string,
  body?: Uint8Array,
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};
  const { hostname: to_hostname, pathname, search } = api_url;
  headers["x-dweb-cloud-host"] = to_hostname;
  headers["x-dweb-cloud-origin"] = `${api_url.protocol}//${origin_hostname}`;
  const noise = crypto.randomUUID();
  headers["x-dweb-cloud-noise"] = `${noise}`;
  const header = Buffer.from(
    [
      /// METHOD + URL
      method.toUpperCase() + " " + pathname + search,
      /// HEAD
      `ALGORITHM bioforestchain`,
      `FROM ${origin_hostname}`,
      `TO ${to_hostname}`,
      `NOISE ${noise}`,
    ].join("\n") + "\n",
  );
  const signMsg = body ? Buffer.concat([header, body]) : header;

  const signature = await bfmetaSignUtil.detachedSign(
    signMsg,
    keypair.privateKey,
  );
  headers["x-dweb-cloud-algorithm"] = "bioforestchain";
  headers["x-dweb-cloud-public-key"] = toSafeBuffer(keypair.publicKey);
  headers["x-dweb-cloud-signature"] = toSafeBuffer(signature as Buffer);

  console.debug("signMsg", signMsg.toString());
  console.debug("signature", signature.toString("hex"));
  console.debug("publicKey", keypair.publicKey.toString("hex"));
  return headers;
};

export const verifyRequest = (
  req_url: string,
  req_method: string,
  req_headers: Headers,
  req_body?: Uint8Array | (() => Promise<Uint8Array | undefined>),
): {
  verify: () => Promise<boolean>;
  publicKey: Buffer;
  from_hostname: string;
  to_hostname: string;
} => {
  let safe_req_url = req_url;
  if (req_url.startsWith("http://") || req_url.startsWith("https://")) {
    const { pathname, search } = new URL(req_url);
    safe_req_url = pathname + search;
  }
  const to_hostname = z
    .string({ required_error: "no found header x-dweb-cloud-host" })
    .parse(req_headers.get("x-dweb-cloud-host"));
  const from_hostname = z
    .string({ required_error: "no found header x-dweb-cloud-origin" })
    .parse(req_headers.get("x-dweb-cloud-origin"))
    .split("://")[1];
  const noise = z
    .string({ required_error: "no found header x-dweb-cloud-noise" })
    .parse(req_headers.get("x-dweb-cloud-noise"));

  const publicKey = safeBufferFrom(
    z
      .string({ required_error: "no found header x-dweb-cloud-public-key" })
      .parse(req_headers.get("x-dweb-cloud-public-key")),
  );
  const signature = safeBufferFrom(
    z
      .string({ required_error: "no found header x-dweb-cloud-signature" })
      .parse(req_headers.get("x-dweb-cloud-signature")),
  );
  const verify = async () => {
    const header = Buffer.from(
      [
        /// METHOD + URL
        req_method.toUpperCase() + " " + safe_req_url,
        /// HEAD
        `ALGORITHM bioforestchain`,
        `FROM ${from_hostname}`,
        `TO ${to_hostname}`,
        `NOISE ${noise}`,
      ].join("\n") + "\n",
    );
    if (typeof req_body === "function") {
      req_body = await req_body();
    }
    const signMsg = req_body ? Buffer.concat([header, req_body]) : header;
    return bfmetaSignUtil.detachedVeriy(signMsg, signature, publicKey);
  };
  return {
    verify,
    publicKey,
    from_hostname,
    to_hostname,
  };
};

export type Keypair = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const authRequestWithBody = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<{
  address: string;
  rawBody: Buffer | undefined;
  publicKey: Buffer;
  from_hostname: string;
  to_hostname: string;
}> => {
  const algorithm = z
    .string({ required_error: "require algorithm" })
    .parse(req.headers["x-dweb-cloud-algorithm"]);
  if (algorithm !== "bioforestchain") {
    throw new ResponseError(
      500,
      `Not yet support sign algorithm: ${algorithm}`,
    ).end(res);
  }
  const req_method = req.method ?? "GET";
  const rawBody = await getNodeReqBody(req);
  const { verify, ...info } = verifyRequest(
    req.url ?? "/",
    req_method,
    new Headers(req.headers as Record<string, string>),
    rawBody,
  );
  if (false === (await verify())) {
    throw new ResponseError(401, "fail to veriy").end(res);
  }
  return {
    ...info,
    address: await bfmetaSignUtil.getAddressFromPublicKey(info.publicKey),
    rawBody,
  };
};
