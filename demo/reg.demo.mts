import { parseArgs } from "@std/cli/parse-args";
import { import_meta_ponyfill } from "import-meta-ponyfill";
import { setupVerbose } from "../src/helper/logger.mts";
import process from "node:process";
import { registry } from "../src/client.mts";
import { z } from "zod";

export const doReg = async (args: {
  gateway: string;
  port: number;
  secret?: string;
}) => {
  const { gateway, port, secret = Math.random().toString(36).slice(2) } = args;
  console.info("using secret:", secret);
  const packet = await registry({
    gateway: gateway,
    keypair: secret,
    algorithm: "bioforestchain",
    service: {
      mode: "http",
      // hostname: "127.0.0.1", // hostname 可以不填，会根据 http 请求中的 ip 来获取
      port: port,
    },
  });
  console.debug(packet.url.href, packet.headers, packet.info);
  const origin = await packet.request().then((r) => r.text());

  console.info("registry success", `${origin}/test`);
  return origin;
};

if (import_meta_ponyfill(import.meta).main) {
  setupVerbose();
  await doReg(
    z
      .object({
        gateway: z.string(),
        port: z.number(),
        secret: z.string().optional(),
      })
      .parse(parseArgs(process.argv.slice(2)))
  );
}
