import { parseArgs } from "@std/cli/parse-args";
import import_meta_ponyfill from "import-meta-ponyfill";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import { createMemoryDnsDb, type DnsDB } from "./api/dns-table.mts";
import { query } from "./api/query.mts";
import { registry } from "./api/registry.mts";
import { getCliArgs, getDefaultHost, getDefaultPort } from "./args.mts";
import { setupVerbose } from "./helper/logger.mts";
import { startMdnsServer } from "./mdns.mts";
export * from "./api/dns-table.mts";
export const startGateway = (
  db: DnsDB,
  host: string,
  port: number,
  options: { cert?: string; key?: string } = {},
): Promise<AddressInfo> => {
  let origin = host;
  if (false == origin.includes("://")) {
    origin = "http://" + host;
  }
  const origin_url = new URL(origin);
  const gateway = {
    protocol: origin_url.protocol,
    hostname: origin_url.hostname,
    port: origin_url.port ? +origin_url.port : port,
  };

  if (gateway.hostname.endsWith(".local")) {
    startMdnsServer(db, gateway.hostname);
  }

  const onRequest: http.RequestListener<
    typeof http.IncomingMessage,
    typeof http.ServerResponse
  > = async (req, res) => {
    try {
      /// 网关转发
      const hostname = req.headers.host?.split(":").at(0);
      if (hostname && await db.dnsTable.has(hostname)) {
        const target = (await db.dnsTable.get(hostname))!;
        const { pathname, search } = new URL(
          `http://localhost${req.url ?? "/"}`,
        );
        console.log("gateway", hostname, "=>", target, pathname, search);
        const forwarded_req = http.request(
          {
            hostname: target.hostname,
            port: target.port,
            method: req.method,
            path: pathname + search,
            headers: req.headers,
          },
          (forwarded_res) => {
            forwarded_res.pipe(res);
          },
        );
        req.pipe(forwarded_req);
        return;
      }

      /// 网关服务
      const { pathname, searchParams } = new URL(`http://localhost${req.url}`);
      if (pathname === "/registry") {
        return await registry(db, gateway, req, res);
      }
      if (pathname === "/query") {
        return await query(db, searchParams, req, res);
      }
      res.statusCode = 404;
      return res.end("Not Found");
    } catch (e) {
      if (false === res.writableEnded) {
        res.statusCode = 500;
        res.end(e instanceof Error ? e.stack ?? e.message : String(e));
      }
    }
  };

  let server: https.Server | http.Server;
  if (origin_url.protocol === "https:") {
    const cert_filename = z
      .string({ required_error: "https requires cert file" })
      .parse(options.cert);
    const key_filename = z
      .string({ required_error: "https requires key file" })
      .parse(options.key);
    server = https.createServer(
      {
        cert: fs.readFileSync(cert_filename),
        key: fs.readFileSync(key_filename),
      },
      onRequest,
    );
  } else {
    server = http.createServer(onRequest);
  }
  const job = Promise.withResolvers<AddressInfo>();
  server.listen({ port: gateway.port }, () => {
    const addressInfo = server.address() as AddressInfo;
    job.resolve(addressInfo);
    console.info(
      `Dweb Gateway Server Listening.\n--gateway=http://${gateway.hostname}:${gateway.port}/`,
    );
  });
  return job.promise;
};

if (import_meta_ponyfill(import.meta).main) {
  setupVerbose();
  const cliArgs = parseArgs(getCliArgs(), {
    string: ["host", "port", "cert", "key"],
    alias: {
      host: "h",
      port: "p",
    },
  });
  const hostname = getDefaultHost({ cliArgs });
  const port = getDefaultPort({ cliArgs });
  const db = createMemoryDnsDb();
  void startGateway(db, hostname, port, cliArgs);
}
