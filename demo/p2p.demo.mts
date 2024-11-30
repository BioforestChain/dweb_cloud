import { startMdnsServer, type ServiceDiscovery } from "../src/mdns/mod.mts";
import { getDefaultHost } from "../src/args.mts";
import process from "node:process";
import { createServer } from "node:http";

// 检查是否是主模块
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

async function main() {
  try {
    const hostname = await getDefaultHost();
    console.log("Starting P2P node with hostname:", hostname);

    // 创建P2P节点
    const p2pNode = startMdnsServer(hostname);

    // 生成随机端口 (49152-65535)
    const port = Math.floor(Math.random() * (65535 - 49152) + 49152);

    // 存储发现的对等节点
    const peers = new Map<string, ServiceDiscovery>();

    // 创建HTTP服务器处理P2P请求
    const httpServer = createServer((req, res) => {
      // 允许跨域访问
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Content-Type", "application/json");

      console.log(`收到请求: ${req.method} ${req.url}`);

      // 获取所有对等节点
      if (req.url === "/peers" && req.method === "GET") {
        const peerList = [...peers.values()];
        console.log("返回对等节点列表:", peerList); // 添加响应日志
        res.writeHead(200);
        res.end(JSON.stringify(peerList));
        return;
      }

      // 获取节点状态
      if (req.url === "/status" && req.method === "GET") {
        const status = {
          peerId: peerId,
          connectedPeers: peers.size,
          uptime: process.uptime(),
          hostname,
          port,
        };
        console.log("返回节点状态:", status);
        res.writeHead(200);
        res.end(JSON.stringify(status));
        return;
      }

      console.log("未找到路由，返回404");
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not Found" }));
    });

    // 注册P2P服务
    const peerId = `peer-${Math.random().toString(36).substr(2, 9)}`;
    p2pNode.registerService({
      serviceName: "dweb-peer",
      serviceType: "tcp",
      port: port,
      protocol: "tcp",
      metadata: {
        nodeType: "peer",
        capabilities: "storage,compute,network",
        resources: JSON.stringify({
          storage: "available",
          compute: "active",
        }),
        peerId,
      },
    });

    // 监听对等节点发现
    p2pNode.onServiceDiscovery((service: ServiceDiscovery) => {
      const discoveredPeerId = service.metadata?.peerId as string || service.serviceName;
      console.log("\n发现新对等节点:", {
        serviceName: service.serviceName,
        peerId: discoveredPeerId,
        metadata: service.metadata,
      });

      if (service.serviceName === "dweb-peer") {
        // 不添加自己作为对等节点
        if (discoveredPeerId === peerId) {
          return;
        }
        peers.set(discoveredPeerId, service);
        console.log("\n添加新对等节点:", {
          peerId: discoveredPeerId,
          capabilities: service.metadata.capabilities,
          resources: service.metadata.resources,
          address: `${service.metadata.hostname || hostname}:${service.port}`,
        });
      }
    });

    // 监听对等节点离线
    p2pNode.onServiceLost((service: ServiceDiscovery) => {
      if (service.metadata?.peerId) {
        peers.delete(service.metadata.peerId as string);
        console.log("\n对等节点离线:", {
          peerId: service.metadata.peerId,
          address: `${hostname}:${service.port}`,
        });
        console.log(`当前在线节点数: ${peers.size}`);
      }
    });

    // 监听健康状态
    p2pNode.onHealthCheck((data) => {
      console.log("\n节点健康状态:", {
        nodeId: data.serviceId,
        status: data.health.status,
        uptime: data.health.uptime,
        metrics: data.health.metrics,
      });
    });

    // 主动查询其他节点
    // deno-lint-ignore no-unused-vars
    const queryPeers = () => {
      console.log("\n正在查询网络中的对等节点...");
      p2pNode.query({
        questions: [
          {
            name: "_dweb-peer._tcp.local",
            type: "PTR",
          },
        ],
        type: "query",
        id: 0,
        flags: 0,
        answers: [],
        additionals: [],
        authorities: []
      });
    };

    // 定期查询对等节点
    // const queryInterval = setInterval(queryPeers, 5000);
    // 初始查询
    // queryPeers();

    // 定期打印当前连接的节点信息
    const printPeersInterval = setInterval(() => {
      if (peers.size > 0) {
        console.log("\n当前连接的节点:");
        for (const [peerId, peer] of peers) {
          console.log(`- ${peerId}: ${hostname}:${peer.port}`);
        }
      }
    }, 10000);

    // 监听进程退出
    process.on("SIGINT", () => {
      console.log("\n正在关闭P2P节点...");
      clearInterval(printPeersInterval);
      // clearInterval(queryInterval);
      httpServer.close();
      p2pNode.destroy();
      console.log("P2P节点已停止.");
      process.exit(0);
    });

    // 启动HTTP服务器，监听所有网络接口
    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`P2P节点已启动:`);
      console.log(`- Local: http://localhost:${port}`);
      console.log(`- Network: http://${hostname}:${port}`);
      console.log("\nHTTP API endpoints:");
      console.log(`- GET /peers - 获取所有对等节点`);
      console.log(`- GET /status - 获取节点状态`);
      console.log("\n按 Ctrl+C 停止节点\n");
    });

    // 保持进程运行
    process.on("uncaughtException", console.error);
    process.on("unhandledRejection", console.error);
  } catch (error) {
    console.error("启动失败:", error);
    process.exit(1);
  }
}

if (isMainModule) {
  main().catch(console.error);
}
