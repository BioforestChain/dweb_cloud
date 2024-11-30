import { import_meta_ponyfill } from "import-meta-ponyfill";
import { getDefaultHost } from "./args.mts";
import { startMdnsServer, type ServiceDiscovery } from "./mdns/mod.mts";
import process from "node:process";

if (import_meta_ponyfill(import.meta).main) {
  const hostname = await getDefaultHost();
  const server = startMdnsServer(hostname);

  // 注册一个HTTP服务
  const webService: ServiceDiscovery = {
    serviceName: "web-api",
    serviceType: "http",
    port: 8080,
    protocol: "tcp",
    metadata: {
      healthEndpoint: "/api/health", // 自定义健康检查端点
      hostname: "api.example.com", // 自定义主机名
      version: "1.0.0",
      environment: "development",
      description: "Web API Service",
      tags: "api,web,public",
    },
  };

  server.registerService(webService);

  // 监听服务健康状态变化
  server.onHealthCheck(({ serviceId, health }) => {
    console.log(`Service ${serviceId} health status: ${health.status}`);
    console.log(`Response time: ${health.metrics.responseTime}ms`);
    console.log(`Success rate: ${health.metrics.successRate * 100}%`);
    console.log(`Last check: ${health.lastCheck}`);
    console.log(`Uptime: ${health.uptime}s\n`);
  });

  // 监听服务发现事件
  server.onServiceDiscovery((service) => {
    console.log(`New service discovered: ${service.serviceName}`);
    console.log(`Type: ${service.serviceType}`);
    console.log(`Port: ${service.port}`);
    console.log(`Metadata:`, service.metadata, "\n");
  });

  // 监听服务丢失事件
  server.onServiceLost((service) => {
    console.log(`Service lost: ${service.serviceName}`);
    console.log(`Type: ${service.serviceType}\n`);
  });

  // 监听查询事件
  server.onQuery(({ query, rinfo }) => {
    console.log(`Received query from ${rinfo.address}:${rinfo.port}`);
    console.log(`Query:`, query.questions, "\n");
  });

  // 监听响应事件
  server.onResponse((response) => {
    console.log(`Received response:`, response.answers, "\n");
  });

  // 处理进程退出
  process.on("SIGINT", () => {
    console.log("\nShutting down mDNS server...");
    server.destroy();
    console.log("Server stopped gracefully.");
    process.exit(0);
  });

  console.log(`mDNS server started with hostname: ${hostname}`);
  console.log("Press Ctrl+C to stop the server.\n");
}
