import import_meta_ponyfill from "import-meta-ponyfill";
import http from "node:http";
import { AddressInfo } from "node:net";
import { dnsTable } from "./api/dns-table.mts";
import { registry } from "./api/registry.mts";
import { getDefaultHost, getDefaultPort } from "./args.mts";
import { startMdnsServer } from "./mdns.mts";
import { setupVerbose } from "./helper/logger.mts";
import { query } from "./api/query.mts";
const startGateway = (host: string, port: number) => {
  let origin = host;
  if (false == origin.includes("://")) {
    origin = "http://" + host;
  }
  const origin_url = new URL(origin);
  const gateway = {
    hostname: origin_url.hostname,
    port: origin_url.port ? +origin_url.port : port,
  };

  if (gateway.hostname.endsWith(".local")) {
    startMdnsServer(gateway.hostname);
  }

  const server = http.createServer(async (req, res) => {
    /// 网关转发
    const hostname = req.headers.host?.split(":").at(0);
    if (hostname && dnsTable.has(hostname)) {
      const target = dnsTable.get(hostname)!;
      console.log("gateway", hostname, "=>", target);
      const { pathname, search } = new URL(`http://localhost${req.url ?? "/"}`);
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
      return await registry(gateway, req, res);
    }
    if (pathname === "/query") {
      return await query(searchParams, req, res);
    }
    res.statusCode = 404;
    return res.end("Not Found");
  });

  const job = Promise.withResolvers<AddressInfo>();
  server.listen(gateway.port, () => {
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
  const hostname = await getDefaultHost();
  const port = await getDefaultPort();
  await startGateway(hostname, port);
}
