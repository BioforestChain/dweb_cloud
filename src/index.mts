import { map_get_or_put_async } from "@gaubee/util";
import http from "node:http";
import { fileURLToPath } from "node:url";
import worker_threads from "node:worker_threads";

const resolveTo = (path: string) => fileURLToPath(import.meta.resolve(path));

const server = http.createServer({
  // ALPNCallback(arg) {
  //     console.log(arg.servername);
  //     return undefined;
  // },
});

server.addListener("request", async (req, res) => {
  console.log(req.headers, req.url);
  const { host: host } = req.headers;
  if (!host) {
    res.statusCode = 502;
    res.end();
    return;
  }
  console.log("vmWokers.get(host)", vmWokers.get(host));
  const vmWorker = await map_get_or_put_async(vmWokers, host, () => {
    console.log("new worker", host);
    const worker = new worker_threads.Worker(resolveTo("./worker.mjs"), {
      workerData: {
        host: host,
      },
    });
    const job = Promise.withResolvers<VmWorker>();
    worker.once("message", (data) => {
      if (Array.isArray(data) && data[0] === "ready") {
        job.resolve(new VmWorker(worker, data[1]));
      } else {
        job.reject();
      }
    });
    return job.promise;
  });
  const forwarded_req = http.request(
    {
      hostname: "0.0.0.0",
      port: vmWorker.port,
      method: req.method,
      headers: req.headers,
      path: req.url,
    },
    (forwarded_res) => {
      forwarded_res.pipe(res);
    },
  );
  req.pipe(forwarded_req);
});

const vmWokers = new Map<string, VmWorker>();
class VmWorker {
  constructor(readonly worker: worker_threads.Worker, readonly port: number) {}
}

server.listen(9000, () => {
  console.log("server start at", server.address());
});
