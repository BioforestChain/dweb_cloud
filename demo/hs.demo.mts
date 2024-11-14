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
