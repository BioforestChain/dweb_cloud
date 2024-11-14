import http from "node:http";
import process from "node:process";
import { parseArgs } from "@std/cli/parse-args";

const args = parseArgs(process.argv.slice(1));
const port = args.port || 80;

http
  .createServer((req, res) => {
    res.end(JSON.stringify(req.headers, null, 2) + "\n" + req.url);
  })
  .listen(port, () => {
    console.log(`Server Listening http://localhost:${port}`);
  });

import { registry } from "../src/client.mts";

const secret = "abc";
const packet = await registry({
  gateway: "http://gaubee.local:8080/",
  keypair: secret,
  algorithm: "bioforestchain",
  service: {
    mode: "http",
    port: port,
  },
});
console.log(packet.url.href, packet.headers, packet.info);
const res = await fetch(packet.url, {
  method: packet.method,
  headers: packet.headers,
  body: packet.body,
}).then((r) => r.text());

console.log("res", res);
