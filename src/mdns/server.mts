import makeMdns, {
  type ResponseOutgoingPacket,
  type QueryPacket,
  type ResponsePacket,
  type Question
} from "multicast-dns";
import { EventEmitter } from "node:events";
import type { ServiceDiscovery, ServiceHealth, MdnsEvents, RemoteInfo } from './types.mts';
import { HealthChecker } from './health.mts';
import { getWlanIpv4List } from './network.mts';

export class MdnsServer extends EventEmitter {
  private mdns = makeMdns();
  private services = new Map<string, ServiceDiscovery>();
  private healthStatus = new Map<string, ServiceHealth>();
  private checkInterval: number | null = null;
  private suffix_host: string;
  private ipv4List: ReturnType<typeof getWlanIpv4List>;

  public on<K extends keyof MdnsEvents>(event: K, listener: MdnsEvents[K]): this;
  // deno-lint-ignore no-explicit-any
  public on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  public emit<K extends keyof MdnsEvents>(event: K, ...args: Parameters<MdnsEvents[K]>): boolean;
  // deno-lint-ignore no-explicit-any
  public emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  constructor(private hostname: string, private checkIntervalMs: number = 30000) {
    super();
    this.suffix_host = `.${hostname}.local`;
    this.ipv4List = getWlanIpv4List();
    this.setupMdnsListeners();
    this.startHealthCheck();
  }

  private setupMdnsListeners() {
    this.mdns.on("response", (response: ResponsePacket, rinfo: RemoteInfo) => {
      this.emit("response", response);
      this.handleResponse(response, rinfo);
    });

    this.mdns.on("query", (query: QueryPacket, rinfo: RemoteInfo) => {
      this.emit("query", query, rinfo);
      this.handleQuery(query);
    });
  }

  private handleResponse(response: ResponsePacket, _rinfo: RemoteInfo) {
    if (!response.answers) return;
    console.log('收到mDNS响应:', response.answers);

    for (const answer of response.answers) {
      if (answer.type === 'PTR') {
        const serviceInstance = answer.data;
        if (!serviceInstance) continue;

        const srvRecord = response.answers.find((a: { type: string; name: string }) => 
          a.type === 'SRV' && a.name === serviceInstance
        );

        const txtRecord = response.answers.find((a: { type: string; name: string; data?: string | string[] }) => 
          a.type === 'TXT' && a.name === serviceInstance
        );

        console.log('找到记录:', { serviceInstance, srvRecord, txtRecord });

        if (srvRecord) {
          const [serviceName, serviceType, protocol] = serviceInstance.split('.');
          if (!serviceName || !serviceType || !protocol) continue;

          const newService: ServiceDiscovery = {
            serviceName: serviceName.replace(/^_/, ''),
            serviceType: serviceType.replace(/^_/, ''),
            port: srvRecord.data.port,
            protocol: protocol === 'local' ? serviceType.replace(/^_/, '') : protocol,
            metadata: {
              hostname: srvRecord.data.target,
              weight: srvRecord.data.weight,
              priority: srvRecord.data.priority,
              peerId: serviceName  // 使用服务名称作为 peerId
            }
          };

          if (txtRecord && txtRecord.data) {
            console.log('解析TXT记录:', txtRecord.data);
            const txtData = Array.isArray(txtRecord.data) ? txtRecord.data : [txtRecord.data];
            txtData.forEach((txt: string) => {
              try {
                const [key, value] = txt.toString().split('=');
                if (key && value) {
                  newService.metadata[key] = value;
                }
              } catch (error) {
                console.error('解析TXT记录错误:', error);
              }
            });
          }

          console.log('创建新服务:', newService);
          this.services.set(newService.serviceName, newService);
          this.emit('service-discovery', newService);
        }
      } else if (answer.type === 'SRV') {
        const [serviceName, serviceType, protocol] = answer.name?.split('.') || [];
        if (!serviceName || !serviceType || !protocol) return;

        const newService: ServiceDiscovery = {
          serviceName,
          serviceType,
          port: answer.data.port,
          protocol: protocol === 'local' ? serviceType : protocol, // 如果是 .local 则使用 serviceType
          metadata: {
            hostname: answer.data.target,
            weight: answer.data.weight,
            priority: answer.data.priority
          }
        };

        // 查找相关的 TXT 记录以获取额外的元数据
        const txtRecord = response.answers.find((answer: { type: string; name: string; data?: string | string[] }) => 
          answer.type === 'TXT' && answer.name === `${serviceName}.${serviceType}.${protocol}`
        );
        if (txtRecord && txtRecord.data) {
          // 解析 TXT 记录中的元数据
          const txtData = Array.isArray(txtRecord.data) ? txtRecord.data : [txtRecord.data];
          txtData.forEach((txt: string) => {
            try {
              if (typeof txt === 'string') {
                const [key, ...valueParts] = txt.toString().split('=');
                if (key && valueParts.length > 0) {
                  const value = valueParts.join('='); // 重新组合可能包含 = 的值
                  try {
                    newService.metadata[key] = JSON.parse(value);
                  } catch {
                    newService.metadata[key] = value;
                  }
                }
              }
            } catch (error) {
              console.error('Error parsing TXT record:', error);
            }
          });
        }

        // 检查是否已经知道这个服务
        const existingService = this.services.get(serviceName);
        if (!existingService) {
          // 发现新服务
          this.services.set(serviceName, newService);
          this.emit('service-discovery', newService);
        }
      }
    }
  }

  private handleQuery(query: QueryPacket) {
    const questions = query.questions || [];
    const responses: ResponseOutgoingPacket[] = [];

    for (const question of questions) {
      const service = this.findServiceByQuestion(question);
      if (service) {
        responses.push(this.createResponsePacket(service));
      }
    }

    if (responses.length > 0) {
      this.mdns.respond(responses);
    }
  }

  private findServiceByQuestion(question: Question): ServiceDiscovery | undefined {
    if (!question.name) return undefined;

    const name = question.name.toLowerCase();
    for (const service of this.services.values()) {
      // 构造标准的服务名称
      const serviceFullName = `_${service.serviceName}._${service.protocol}.local`.toLowerCase();
      if (name === serviceFullName) {
        return service;
      }
    }
    return undefined;
  }

  private createResponsePacket(service: ServiceDiscovery): ResponseOutgoingPacket {
    const serviceName = `_${service.serviceName}._${service.protocol}.local`;
    const instanceName = `${service.metadata.peerId || service.serviceName}.${serviceName}`;
    
    // 准备 TXT 记录数据
    const txtRecords = Object.entries(service.metadata || {}).map(([key, value]) => {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${key}=${valueStr}`;
    });

    return {
      answers: [
        {
          name: serviceName,
          type: 'PTR',
          ttl: 120,
          data: instanceName
        },
        {
          name: instanceName,
          type: 'SRV',
          ttl: 120,
          data: {
            port: service.port,
            target: `${this.hostname}.local`,
            weight: 0,
            priority: 0,
          },
        },
        {
          name: instanceName,
          type: 'TXT',
          ttl: 120,
          data: txtRecords
        }
      ],
    };
  }

  // 发送 mDNS 查询
  public query(query: QueryPacket) {
    console.log('发送 mDNS 查询:', query);
    this.mdns.query(query);
  }

  // 广播服务
  public broadcastService(service: ServiceDiscovery) {
    const packet = this.createResponsePacket(service);
    console.log('广播服务:', packet);
    this.mdns.respond(packet);
  }

  private startHealthCheck() {
    if (this.checkInterval !== null) {
      return;
    }

    const healthChecker = new HealthChecker();
    this.checkInterval = setInterval(async() => {
      for (const [serviceId, service] of this.services) {
        const health = await healthChecker.checkServiceHealth(service);
        this.healthStatus.set(serviceId, health);
        this.emit('health-check', { serviceId, health });
      }
    }, this.checkIntervalMs);
  }

  public registerService(service: ServiceDiscovery) {
    const serviceId = service.serviceName;
    
    // 确保服务名称和协议没有前缀下划线
    service.serviceName = service.serviceName.replace(/^_+/, '');
    service.protocol = service.protocol.replace(/^_+/, '');
    
    this.services.set(serviceId, service);

    // 立即广播新服务
    this.broadcastService(service);

    // 定期重新广播服务
    const rebroadcastInterval = setInterval(() => {
      if (this.services.has(serviceId)) {
        this.broadcastService(service);
      } else {
        clearInterval(rebroadcastInterval);
      }
    }, 60000); // 每分钟重新广播一次
  }

  public destroy() {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.mdns.destroy();
  }
}

// 创建服务器实例的工厂函数
export function startMdnsServer(hostname: string) {
  return new MdnsServer(hostname);
}
