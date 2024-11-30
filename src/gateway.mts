import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import type { DnsDB } from "./api/dns-table.mts";
import { query } from "./api/query.mts";
import { fastDnsRecordByHostname, registry } from "./api/registry.mts";
export * from "./api/dns-table.mts";
declare const DWEB_CLOUD_DISABLE_MDNS: boolean | void;
export const startGateway = async (
  db: DnsDB,
  options: {
    host: string;
    port: number;
    sep: string;
    cert?: string;
    key?: string;
  },
): Promise<AddressInfo> => {
  const { host, port } = options;
  let origin = host;
  if (false == origin.includes("://")) {
    origin = "http://" + host;
  }
  const origin_url = new URL(origin);
  const gateway = {
    protocol: origin_url.protocol,
    hostname: origin_url.hostname,
    port: origin_url.port ? +origin_url.port : port,
    sep: options.sep,
  };
  if (gateway.hostname.endsWith(".local")) {
    if (
      typeof DWEB_CLOUD_DISABLE_MDNS === "boolean" &&
      DWEB_CLOUD_DISABLE_MDNS
    ) {
      console.warn("MDNS DISABLED", gateway.hostname);
    } else {
      const { startMdnsServer } = await import("./mdns/mod.mts");
      startMdnsServer(gateway.hostname);
    }
  }

  const onRequest: http.RequestListener<
    typeof http.IncomingMessage,
    typeof http.ServerResponse
  > = async (req, res) => {
    try {
      /// 网关转发
      const hostname = (
        req.headersDistinct["x-dweb-cloud-host"] ?? req.headersDistinct.host
      )
        ?.at(0)
        ?.split(":")
        .at(0);
      if (hostname && (await db.dnsTable.has(hostname))) {
        const { dnsRecord, lookup } = await fastDnsRecordByHostname(
          db,
          gateway,
          hostname,
        );
        console.info("[GATEWAY]", hostname, req.url);
        const forwarded_req = http.request(
          {
            hostname: lookup.address,
            port: dnsRecord.port,
            method: req.method,
            path: req.url ?? "/",
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
      const { pathname, searchParams } = new URL(
        req.url ?? "",
        "https://parse.url",
      );
      if (pathname === "/registry" && req.method === "POST") {
        return await registry(db, gateway, req, res);
      }
      if (pathname === "/query" && req.method === "GET") {
        return await query(db, searchParams, req, res);
      }
      res.statusCode = 404;
      return res.end("Hello Dweb Cloud.");
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
