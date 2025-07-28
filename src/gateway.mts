import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import url from "node:url";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import type { DnsDB } from "./api/dns-table.mts";
import { query } from "./api/query.mts";
import { fastDnsRecordByHostname, registry } from "./api/registry.mts";
import { dnsRecordStringify } from "./helper/dns-record.mts";
import type { BFMetaSignUtil } from "@bfmeta/sign-util";
export * from "./api/dns-table.mts";
import { match, P } from "ts-pattern";
declare const DWEB_CLOUD_DISABLE_MDNS: boolean | void;
export const startGateway = async (
  signUtil: BFMetaSignUtil,
  db: DnsDB,
  options: {
    sep: string;
    gateway:
      | {
          protocol?: string;
          hostname: string;
          port?: number | string;
        }
      | string
      | URL
      | {
          protocol?: string;
          host: string;
        };
    local: {
      https?: boolean;
      cert?: string;
      key?: string;
      port?: number;
    };
  },
): Promise<AddressInfo> => {
  const { gateway: gateway_origin, local } = options;

  const gateway_origin_url = match(gateway_origin)
    .with(P.string, (href) => new URL(href))
    .with(P.instanceOf(URL), (v) => v)
    .with(
      {
        protocol: P.string.optional(),
        hostname: P.string,
        port: P.string.or(P.number).optional(),
      },
      (origin) =>
        new URL(
          url.format({
            protocol:
              origin.protocol ??
              (origin.hostname.endsWith(".local") ? "http:" : "https:"),
            hostname: origin.hostname,
            port: origin.port,
          }),
        ),
    )
    .with(
      {
        protocol: P.string.optional(),
        host: P.string,
      },
      (origin) =>
        new URL(
          url.format({
            protocol:
              origin.protocol ??
              (origin.host.endsWith(".local") ||
              /\.local:\d+$/.test(origin.host)
                ? "http:"
                : "https:"),
            host: origin.host,
          }),
        ),
    )
    .exhaustive();

  const gateway = {
    protocol: gateway_origin_url.protocol,
    hostname: gateway_origin_url.hostname,
    port: gateway_origin_url.port
      ? +gateway_origin_url.port
      : gateway_origin_url.protocol === "https:"
      ? 443
      : 80,
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
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");

      // 设置允许的 HTTP 方法
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );

      // 设置允许的请求头
      res.setHeader("Access-Control-Allow-Headers", "*");

      // 如果需要，允许携带凭证（如 cookie）
      res.setHeader("Access-Control-Allow-Credentials", "true");

      res.statusCode = 204;
      res.end();
      return;
    }
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
            const { headersDistinct } = forwarded_res;
            for (const key in headersDistinct) {
              res.setHeader(key, headersDistinct[key]);
            }
            res.statusCode = forwarded_res.statusCode;
            res.statusMessage = forwarded_res.statusMessage;
            forwarded_res.pipe(res);
          },
        );
        forwarded_req.on("error", (err) => {
          // 在向客户端发送任何响应之前，检查头是否已经发送
          // 这是一个重要的边界情况：如果错误发生在数据流传输过程中，头可能已经发送出去了
          if (res.headersSent) {
            // 头已发送，我们无法再更改状态码。只能粗暴地中断连接。
            console.error("[GATEWAY] Error after headers sent:", req.url, err);
            res.destroy(); // 销毁套接字
            return;
          }
          console.error("[GATEWAY]", hostname, req.url, err);
          // 向上游客户端返回 502 Bad Gateway
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");

          // 提供一个对客户端友好的、结构化的错误信息
          const errorResponse = {
            error: "Bad Gateway",
            message:
              "The upstream server is unreachable or returned an invalid response.",
            // 提供远程节点信息
            details: { remoteDnsRecordJson: dnsRecordStringify(dnsRecord) },
          };

          res.end(JSON.stringify(errorResponse));
        });
        req.pipe(forwarded_req);
        return;
      }

      /// 网关服务
      const { pathname, searchParams } = new URL(
        req.url ?? "",
        "https://parse.url",
      );
      if (pathname === "/registry" && req.method === "POST") {
        return await registry(signUtil, db, gateway, req, res);
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
  if (local.https) {
    const cert_filename = z
      .string({ required_error: "https requires cert file" })
      .parse(local.cert);
    const key_filename = z
      .string({ required_error: "https requires key file" })
      .parse(local.key);
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
  server.on("error", (err) => {
    job.reject(err);
    console.error("Dweb Gateway Error:", err);
  });
  const bindPort = local.port ?? gateway.port;
  server.listen({ port: bindPort }, () => {
    const addressInfo = server.address() as AddressInfo;
    job.resolve(addressInfo);
    console.info(
      [
        `Dweb Gateway Server Listening.`,
        `local: http://localhost:${bindPort}/`,
        `gateway: ${gateway_origin_url.href}`,
      ].join("\n"),
    );
  });
  return job.promise;
};
