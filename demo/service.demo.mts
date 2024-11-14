import { parseArgs } from "@std/cli/parse-args";
import { import_meta_ponyfill } from "import-meta-ponyfill";
import http from "node:http";
import process from "node:process";
import z from "zod";
import { registry } from "../src/client.mts";
import { setupVerbose } from "src/helper/logger.mts";
import { AddressInfo } from "node:net";

export const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const gateway = z
    .string({
      required_error: "missing --gateway, eg: http://gaubee.local:8080",
    })
    .parse(args.gateway);
  const serverJob = Promise.withResolvers<number>();
  const server = http
    .createServer((req, res) => {
      res.end(JSON.stringify(req.headers, null, 2) + "\n" + req.url);
    })
    .listen(args.port || 0, () => {
      const addressInfo = server.address() as AddressInfo;
      serverJob.resolve(addressInfo.port);
      console.log(`Server Listening http://localhost:${addressInfo.port}`);
    });

  const port = await serverJob.promise;

  const secret = args.secret || Math.random().toString(36).slice(2);
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
  const hostname = await fetch(packet.url, {
    method: packet.method,
    headers: packet.headers,
    body: packet.body,
  }).then((r) => r.text());

  console.info("registry success", `http://${hostname}/test`);
};

if (import_meta_ponyfill(import.meta).main) {
  setupVerbose();
  await main();
}
