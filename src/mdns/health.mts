import type { ServiceDiscovery, ServiceHealth } from './types.mts';

export class HealthChecker {
  private readonly DEFAULT_TIMEOUT = 5000; // 默认超时时间（毫秒）

  /**
   * 检查HTTP/HTTPS服务健康状态
   */
  async checkHttpService(service: ServiceDiscovery): Promise<ServiceHealth> {
    const startTime = performance.now();
    try {
      const healthUrl = service.metadata.healthEndpoint || "/health";
      const protocol = service.metadata.https ? "https" : "http";
      const response = await fetch(
        `${protocol}://${service.metadata.hostname || "localhost"}:${service.port}${healthUrl}`,
        {
          method: "GET",
          signal: AbortSignal.timeout(Number(service.metadata.healthTimeout) || this.DEFAULT_TIMEOUT),
        }
      );
      const responseTime = performance.now() - startTime;
      return this.createHealthStatus(response.ok, responseTime);
    } catch (_error) {
      return this.createHealthStatus(false, performance.now() - startTime);
    }
  }

  /**
   * 检查TCP服务健康状态
   */
  async checkTcpService(service: ServiceDiscovery): Promise<ServiceHealth> {
    const startTime = performance.now();
    try {
      const conn = await Deno.connect({
        hostname: service.metadata.hostname || "localhost",
        port: service.port,
        transport: "tcp",
      });
      conn.close();
      return this.createHealthStatus(true, performance.now() - startTime);
    } catch (_error) {
      return this.createHealthStatus(false, performance.now() - startTime);
    }
  }

  /**
   * 检查UDP服务健康状态
   */
  // deno-lint-ignore require-await
  async checkUdpService(service: ServiceDiscovery): Promise<ServiceHealth> {
    const startTime = performance.now();
    try {
      const listener = Deno.listenDatagram({
        hostname: service.metadata.hostname || "localhost",
        port: service.port,
        transport: "udp",
      });
      listener.close();
      return this.createHealthStatus(true, performance.now() - startTime);
    } catch (_error) {
      return this.createHealthStatus(false, performance.now() - startTime);
    }
  }

  /**
   * 根据服务类型执行健康检查
   */
  async checkServiceHealth(service: ServiceDiscovery): Promise<ServiceHealth> {
    const startTime = performance.now();
    try {
      switch (service.serviceType) {
        case "http":
        case "https":
          return await this.checkHttpService(service);
        case "tcp":
        case "ssh":
          return await this.checkTcpService(service);
        case "udp":
          return await this.checkUdpService(service);
        default:
          // 对于未知的服务类型，假设它是健康的
          return this.createHealthStatus(true, 0);
      }
    } catch (error) {
      console.error(`Health check failed for service ${service.serviceName}:`, error);
      return this.createHealthStatus(false, performance.now() - startTime);
    }
  }

  /**
   * 创建健康状态对象
   */
  private createHealthStatus(isHealthy: boolean, responseTime: number): ServiceHealth {
    return {
      status: isHealthy ? "healthy" : "unhealthy",
      lastCheck: new Date(),
      uptime: performance.now() / 1000,
      metrics: {
        responseTime,
        successRate: isHealthy ? 1.0 : 0.0,
      },
    };
  }
}
