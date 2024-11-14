import http from "node:http";
import { Buffer } from "node:buffer";
import { AddressInfo } from "node:net";
import z from "zod";
import { startMdnsServer } from "./mdns.mts";
import import_meta_ponyfill from "import-meta-ponyfill";
import { getDefaultHost, getDefaultPort } from "./args.mts";
import { registry } from "./api/registry.mts";
import { dnsTable } from "./api/dns-table.mts";
const startGateway = (host: string, port: number) => {
  let origin = host;
  if (false == origin.includes("://")) {
    origin = "http://" + host;
  }
  const origin_url = new URL(origin);
  const safe_hostname = origin_url.hostname;
  const safe_port = origin_url.port ? +origin_url.port : port;

  if (safe_hostname.endsWith(".local")) {
    startMdnsServer(safe_hostname);
  }

  const server = http.createServer(async (req, res) => {
    /// 网关转发
    const hostname = req.headers.host?.split(":").at(0);
    if (hostname && dnsTable.has(hostname)) {
      const target = dnsTable.get(hostname)!;
      const { pathname, search } = new URL(`http://localhost${req.url ?? "/"}`);
      const forwarded_req = http.request(
        {
          hostname: target.hostname.endsWith(".local")
            ? "0.0.0.0"
            : target.hostname,
          port: target.port,
          method: req.method,
          pathname,
          search,
          headers: req.headers,
        },
        (forwarded_res) => {
          forwarded_res.pipe(res);
        }
      );
      req.pipe(forwarded_req);
      return;
    }

    /// 本级服务
    if (req.url === "/registry") {
      return await registry(req, res);
    }
    res.statusCode = 404;
    return res.end("Not Found");
  });

  const job = Promise.withResolvers<AddressInfo>();
  server.listen(safe_port, () => {
    const addressInfo = server.address() as AddressInfo;
    job.resolve(addressInfo);
    console.log(
      `Dweb Gateway Server Listening http://${addressInfo.address}:${addressInfo.port}`
    );
  });
  return job.promise;
};

if (import_meta_ponyfill(import.meta).main) {
  const hostname = await getDefaultHost();
  const port = await getDefaultPort();
  await startGateway(hostname, port);
}
