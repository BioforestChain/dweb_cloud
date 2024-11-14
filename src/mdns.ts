import makeMdns, { ResponseOutgoingPacket } from "multicast-dns";
import os from "node:os";
export const serve_mdns = (host: string) => {
    const suffix_host = `.${host}`;
    const mdns = makeMdns();
    const ipv4List = getWlanIpv4List();
    mdns.on("response", function (response) {
        // console.log("got a response packet:", response);
    });
    mdns.on("query", function (query) {
        // console.log("got a query packet:", query);
        const r: ResponseOutgoingPacket = { answers: [] };
        for (const question of query.questions) {
            console.log("question", question);
            if (question.type === "A" && question.name.endsWith(suffix_host)) {
                r.answers.push(...ipv4List.map((ipv4) =>
                    ({
                        name: question.name,
                        type: question.type,
                        class: "IN",
                        ttl: 300,
                        flash: true,
                        data: ipv4,
                    }) as any
                ));
            }
        }
        if (r.answers.length > 0) {
            console.log(r);
            mdns.respond(r);
        }
    });
};

const getWlanIpv4List = () => {
    const ipv4List: string[] = [];
    for (
        const networkInterface of Object.values(os.networkInterfaces()).flat()
    ) {
        if (
            networkInterface == null || networkInterface.family !== "IPv4" ||
            networkInterface.internal
        ) {
            continue;
        }
        ipv4List.push(networkInterface.address);
    }
    return ipv4List;
};

console.log("getWlanIpv4List", getWlanIpv4List());

serve_mdns("gaubee.local");
