import { parseArgs } from "@std/cli/parse-args";
import { import_meta_ponyfill } from "import-meta-ponyfill";
import http from "node:http";
import { AddressInfo } from "node:net";
import process from "node:process";
import { setupVerbose } from "src/helper/logger.mts";
import { z } from "zod";
import { doReg } from "./reg.demo.mts";

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

  await doReg({
    ...args,
    gateway,
    port,
  });
};

if (import_meta_ponyfill(import.meta).main) {
  setupVerbose();
  await main();
}
