import http from "node:http";
import z from "zod";
import { getReqBody } from "./income-message.mts";
import { Buffer } from "node:buffer";
import { safeBufferFrom } from "./safe-buffer-code.mts";
import { bfmetaSignUtil } from "./bfmeta-sign-util.mts";
import { ResponseError } from "./response-error.mts";

export const authRequestWithBody = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const algorithm = z
    .string({ required_error: "require algorithm" })
    .parse(req.headers["x-dweb-cloud-algorithm"]);
  if (algorithm !== "bioforestchain") {
    throw new ResponseError(
      500,
      `Not yet support sign algorithm: ${algorithm}`
    ).end(res);
  }
  const publicKey = safeBufferFrom(
    z
      .string({ required_error: "require publicKey" })
      .parse(req.headers["x-dweb-cloud-public-key"])
  );
  const signature = safeBufferFrom(
    z
      .string({ required_error: "require signature" })
      .parse(req.headers["x-dweb-cloud-signature"])
  );
  const host = z
    .string({ required_error: "require host" })
    .parse(req.headers["x-dweb-cloud-host"] || req.headers.host);
  const origin = z
    .string({ required_error: "require origin" })
    .parse(req.headers["x-dweb-cloud-origin"] || req.headers.origin);
  const from_hostname = new URL(origin).hostname;
  const to_hostname = new URL(`http://${host}`).hostname;
  const rawBody = await getReqBody(req);
  const signMsg = Buffer.concat([
    Buffer.from(
      [
        /// METHOD + URL
        req.method?.toUpperCase() + " " + (req.url ?? "/"),
        /// HEAD
        `ALGORITHM ${algorithm}`,
        `FROM ${from_hostname}`,
        `TO ${to_hostname}`,
      ].join("\n") + "\n"
    ),
    /// BODY
    rawBody,
  ]);
  console.log("signMsg", signMsg.toString());
  console.log("signature", signature.toString("hex"));
  console.log("publicKey", publicKey.toString("hex"));
  if (
    false ===
    (await bfmetaSignUtil.detachedVeriy(
      /// 必须对来源和意向进行详细的签名，避免被盗签
      signMsg,
      signature,
      publicKey
    ))
  ) {
    throw new ResponseError(401, "fail to veriy").end(res);
  }
  return { publicKey, rawBody, from_hostname, to_hostname };
};
