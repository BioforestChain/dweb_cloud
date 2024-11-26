import dgram from "node:dgram";
import { delay } from "@gaubee/util";
const testNode = () => {
  const server = dgram.createSocket("udp4");
  // socket.on("error", console.error);
  // socket.bind(5353, "127.0.0.1", () => {
  //   console.log("okk", socket.address());
  // });

  server.on("error", (err) => {
    console.error(`server error:\n${err.stack}`);
    server.close();
  });

  server.on("message", (msg, rinfo) => {
    console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  });

  server.on("listening", () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
  });

  server.bind(5353);
};
const deno0 = async () => {
  const listener = Deno.listenDatagram({
    port: 5353,
    reuseAddress: true,
    transport: "udp",
  });
  await delay(10000);
  listener.close();
};

const deno1 = async () => {
  const encoder = new TextEncoder();
  const listener = Deno.listenDatagram({
    port: 10001,
    transport: "udp",
  });
  const peerAddress: Deno.NetAddr = {
    transport: "udp",
    hostname: "127.0.0.1",
    port: 10000,
  };
  await listener.send(encoder.encode("ping"), peerAddress);
  listener.close();
};

const deno2 = async () => {
  const decoder = new TextDecoder();
  const listener = Deno.listenDatagram({
    port: 10000,
    transport: "udp",
  });
  for await (const [data, address] of listener) {
    console.log("Server - received information from", address);
    console.log("Server - received:", decoder.decode(data));
    listener.close();
  }
};

if (import.meta.main) {
  const mode = Deno.args[0];
  if (mode === "1") {
    deno1();
  } else if (mode === "2") {
    deno2();
  } else if (mode == "node") {
    testNode();
  } else {
    deno0();
  }
}
