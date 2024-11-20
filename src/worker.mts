import worker_threads from "node:worker_threads";
import process from "node:process";

const { parentPort, workerData } = worker_threads;
if (null == parentPort) {
    console.log("worker unable run in main thread");
    process.exit(1);
}

import http from "node:http";

const server = http.createServer((req, res) => {
    console.log(req.headers, req.url);
    res.end(`hi~: ${req.url}`);
});
server.listen(() => {
    const addressInfo = server.address() as import("node:net").AddressInfo;
    console.log("worker addressInfo", workerData, addressInfo);

    parentPort.postMessage([
        "ready",
        addressInfo.port,
    ]);
});
