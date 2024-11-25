import makeMdns, { type ResponseOutgoingPacket } from "multicast-dns";
import os from "node:os";
import import_meta_ponyfill from "import-meta-ponyfill";
import { getDefaultHost } from "./args.mts";
import { createMemoryDnsDb, type DnsDB } from "./api/dns-table.mts";
export const startMdnsServer = (db: DnsDB, hostname: string, port = 80) => {
  if (hostname.split(".").length > 2) {
    throw new Error(
      "The '.local' domain does not support subdomains and must be in the top-level domain.",
    );
  }
  const suffix_host = `-${hostname}`;
  const mdns = makeMdns();
  const ipv4List = getWlanIpv4List();
  mdns.on("response", function (response) {
    console.debug("got a response packet:", response);
  });
  mdns.on("query", function (query, rinfo) {
    console.debug("got a query packet=", query.questions, "rinfo=", rinfo);
    const r: ResponseOutgoingPacket = { answers: [] };
    type Answer = ResponseOutgoingPacket["answers"][number];
    for (const question of query.questions) {
      if (
        question.type === "A" &&
        (question.name === hostname || question.name.endsWith(suffix_host))
      ) {
        r.answers.push(
          ...ipv4List
            /// 根据掩码，过滤出局域网
            .filter((ipv4) => {
              return (
                ipv4.masterAddress ===
                  getMasterAddress({
                    address: rinfo.address,
                    netmask: ipv4.netmask,
                  })
              );
            })
            .map(
              (ipv4) =>
                ({
                  name: question.name,
                  type: "A",
                  class: "IN",
                  ttl: 300,
                  flash: true,
                  data: ipv4.address,
                }) as Answer,
            ),
        );
      }
    }
    if (r.answers.length > 0) {
      // console.log(r);
      mdns.respond(r);
    }
  });
  console.debug("mdns server started", getWlanIpv4List(), `*${suffix_host}`);
};

const getWlanIpv4List = () => {
  const ipv4List: Array<{
    address: string;
    netmask: string;
    masterAddress: number;
  }> = [];
  for (const networkInterface of Object.values(os.networkInterfaces()).flat()) {
    if (
      networkInterface == null ||
      networkInterface.family !== "IPv4" ||
      networkInterface.internal
    ) {
      continue;
    }
    ipv4List.push({
      address: networkInterface.address,
      netmask: networkInterface.netmask,
      masterAddress: getMasterAddress(networkInterface),
    });
  }
  return ipv4List;
};

const getMasterAddress = (info: { address: string; netmask: string }) => {
  const address = ip_to_number(info.address);
  const netmask = ip_to_number(info.netmask);
  return address & netmask;
};
const pow24 = 2 ** 24;
const pow16 = 2 ** 16;
const pow8 = 2 ** 8;
const ip_to_number = (ip: string) => {
  const [a, b, c, d] = ip.split(".").map(Number);
  return a * pow24 + b * pow16 + c * pow8 + d;
};

if (import_meta_ponyfill(import.meta).main) {
  const hostname = await getDefaultHost();
  const db = createMemoryDnsDb();
  startMdnsServer(db, hostname);
}
