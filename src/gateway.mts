import http from "node:http";
import { AddressInfo } from "node:net";
const startGateway = (host: string, port?: number) => {
    let origin = host;
    if (false == origin.includes("://")) {
        origin = "http://" + host;
    }
    const origin_url = new URL(origin);
    const safe_hostname = origin_url.hostname;
    const safe_host = origin_url.port ? +origin_url.port : port;

    if(safe_hostname.endsWith(".local")){
        
    }

    const server = http.createServer((req, res) => {
    });

    const job = Promise.withResolvers<AddressInfo>();
    server.listen(port, () => {
        job.resolve(server.address() as AddressInfo);
    });
    return job.promise;
};
