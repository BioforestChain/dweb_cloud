import makeMdns, { ResponseOutgoingPacket } from "multicast-dns";
import os from "node:os";
import import_meta_ponyfill from "import-meta-ponyfill";
import { getDefaultHost } from "./args.mts";
export const startMdnsServer = (hostname: string) => {
  if (hostname.split(".").length > 2) {
    throw new Error(
      "The '.local' domain does not support subdomains and must be in the top-level domain."
    );
  }
  const suffix_host = `-${hostname}`;
  const mdns = makeMdns();
  const ipv4List = getWlanIpv4List();
  mdns.on("response", function (response) {
    // console.log("got a response packet:", response);
  });
  mdns.on("query", function (query) {
    // console.log("got a query packet:", query);
    const r: ResponseOutgoingPacket = { answers: [] };
    for (const question of query.questions) {
      // console.log("question", question);
      if (
        question.type === "A" &&
        (question.name === hostname || question.name.endsWith(suffix_host))
      ) {
        r.answers.push(
          ...ipv4List.map(
            (ipv4) =>
              ({
                name: question.name,
                type: question.type,
                class: "IN",
                ttl: 300,
                flash: true,
                data: ipv4,
              } as any)
          )
        );
      }
    }
    if (r.answers.length > 0) {
      // console.log(r);
      mdns.respond(r);
    }
  });
  console.log("mdns server started", getWlanIpv4List(), `*${suffix_host}`);
};

const getWlanIpv4List = () => {
  const ipv4List: string[] = [];
  for (const networkInterface of Object.values(os.networkInterfaces()).flat()) {
    if (
      networkInterface == null ||
      networkInterface.family !== "IPv4" ||
      networkInterface.internal
    ) {
      continue;
    }
    ipv4List.push(networkInterface.address);
  }
  return ipv4List;
};

if (import_meta_ponyfill(import.meta).main) {
  const hostname = await getDefaultHost();

  startMdnsServer(hostname);
}
