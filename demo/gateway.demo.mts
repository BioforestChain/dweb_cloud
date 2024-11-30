import { startMdnsServer, type ServiceDiscovery } from "../src/mdns/index.mts";
import { getDefaultHost } from "../src/args.mts";
import process from "node:process";
import { createServer } from "node:http";

// 检查是否是主模块
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

async function main() {
  try {
    const hostname = await getDefaultHost();
    console.log("Starting gateway service with hostname:", hostname);

    // 创建网关服务器
    const gatewayServer = startMdnsServer(hostname);
    const registeredServices = new Map<string, ServiceDiscovery>();

    // 创建HTTP服务器
    const httpServer = createServer((req, res) => {
      // 允许跨域访问
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Content-Type', 'application/json');

      console.log(`收到请求: ${req.method} ${req.url}`); // 添加请求日志

      // 列出所有已注册的服务
      if (req.url === '/services' && req.method === 'GET') {
        const services = [...registeredServices.values()];
        console.log('返回服务列表:', services); // 添加响应日志
        res.writeHead(200);
        res.end(JSON.stringify(services));
        return;
      }

      // 查询特定类型的服务
      if (req.url?.startsWith('/services/') && req.method === 'GET') {
        const serviceType = req.url.split('/')[2];
        const services = [...registeredServices.values()].filter(
          s => s.serviceType === serviceType
        );
        console.log('返回过滤后的服务列表:', services); // 添加响应日志
        res.writeHead(200);
        res.end(JSON.stringify(services));
        return;
      }

      console.log('未找到路由，返回404'); // 添加错误日志
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    // 注册网关服务
    gatewayServer.registerService({
      serviceName: "dweb-gateway",
      serviceType: "http",
      port: 8080,
      protocol: "tcp",
      metadata: {
        type: "gateway",
        version: "1.0.0",
        capabilities: "service-registry,load-balancing",
        region: "local"
      }
    });

    // 监听服务发现事件
    gatewayServer.on('service-discovery', (service: ServiceDiscovery) => {
      registeredServices.set(service.serviceName, service);
      console.log('\n发现新服务:', {
        name: service.serviceName,
        type: service.serviceType,
        port: service.port,
        metadata: service.metadata
      });
    });

    // 监听服务丢失事件
    gatewayServer.on('service-lost', (service: ServiceDiscovery) => {
      registeredServices.delete(service.serviceName);
      console.log('\n服务离线:', {
        name: service.serviceName,
        type: service.serviceType,
        port: service.port
      });
    });

    // 监听健康检查事件
    gatewayServer.on('health-check', (data) => {
      console.log('\n服务健康状态:', {
        serviceId: data.serviceId,
        status: data.health.status,
        uptime: data.health.uptime,
        metrics: data.health.metrics
      });
    });

    // 监听进程退出
    process.on('SIGINT', () => {
      console.log("\n正在关闭网关服务器...");
      httpServer.close();
      gatewayServer.destroy();
      console.log("网关服务器已停止.");
      process.exit(0);
    });

    // 启动HTTP服务器，监听所有网络接口
    httpServer.listen(8080, '0.0.0.0', () => {
      console.log(`网关服务器已启动:`);
      console.log(`- Local: http://localhost:8080`);
      console.log(`- Network: http://${hostname}:8080`);
      console.log('\nHTTP API endpoints:');
      console.log('- GET /services - 列出所有服务');
      console.log('- GET /services/:type - 查询特定类型的服务');
      console.log('\n按 Ctrl+C 停止服务器\n');
    });

    // 保持进程运行
    process.on('uncaughtException', console.error);
    process.on('unhandledRejection', console.error);
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

if (isMainModule) {
  main().catch(console.error);
}
