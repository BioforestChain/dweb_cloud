import { pureEvent } from "@gaubee/util";
import {
  multicastDNS,
  type mDNS,
  type Question,
  type SrvAnswer,
  type TxtAnswer,
} from "../multicast-dns/index.mts";
import { Buffer } from "node:buffer";
import { getWlanIpv4List } from "./network.mts";
import type {
  RemoteInfo,
  ServiceDiscovery,
  ServiceHealth,
  ServiceType,
} from "./types.mts";

export class MdnsServer {
  private mdns = multicastDNS();
  private services = new Map<string, ServiceDiscovery>();
  private healthStatus = new Map<string, ServiceHealth>();
  private checkInterval: number | null = null;
  private suffix_host;
  private ipv4List;
  readonly onResponse = pureEvent<mDNS.ResponsePacket>(); // 收到响应时触发
  readonly onQuery = pureEvent<{
    query: mDNS.QueryPacket;
    rinfo: RemoteInfo;
  }>(); // 收到查询时触发
  readonly onError = pureEvent<Error>(); // 发生错误时触发
  readonly onReady = pureEvent<void>(); // 服务就绪时触发
  readonly onServiceDiscovery = pureEvent<ServiceDiscovery>(); // 发现新服务时触发
  readonly onServiceLost = pureEvent<ServiceDiscovery>(); // 服务丢失时触发
  readonly onHealthCheck = pureEvent<{
    serviceId: string;
    health: ServiceHealth;
  }>(); // 健康检查完成时触发

  constructor(
    private hostname: string,
    private checkIntervalMs: number = 30000,
  ) {
    this.suffix_host = `.${hostname}.local`;
    this.ipv4List = getWlanIpv4List();
    this.setupMdnsListeners();
  }

  private setupMdnsListeners() {
    this.mdns.on(
      "response",
      (response: mDNS.ResponsePacket, rinfo: RemoteInfo) => {
        this.onResponse.emit(response);
        this.handleResponse(response, rinfo);
      },
    );

    this.mdns.on("query", (query: mDNS.QueryPacket, rinfo: RemoteInfo) => {
      this.onQuery.emit({ query, rinfo });
      this.handleQuery(query);
    });
  }

  private handleResponse(response: mDNS.ResponsePacket, _rinfo: RemoteInfo) {
    if (!response.answers) return;
    console.log("收到mDNS响应:", response.answers);

    for (const answer of response.answers) {
      if (answer.type === "PTR") {
        const serviceInstance = answer.data;
        if (!serviceInstance) continue;

        const srvRecord = response.answers.find(
          (a) => a.type === "SRV" && a.name === serviceInstance,
        ) as SrvAnswer | undefined;

        const txtRecord = response.answers.find(
          (a) => a.type === "TXT" && a.name === serviceInstance,
        ) as TxtAnswer | undefined;

        console.log("找到记录:", { serviceInstance, srvRecord, txtRecord });

        if (srvRecord) {
          const [serviceName, serviceType, protocol] =
            serviceInstance.split(".");
          if (!serviceName || !serviceType || !protocol) continue;

          const newService: ServiceDiscovery = {
            serviceName: serviceName.replace(/^_/, ""),
            serviceType: serviceType.replace(/^_/, "") as ServiceType,
            port: srvRecord.data.port,
            protocol:
              protocol === "local" ? serviceType.replace(/^_/, "") : protocol,
            metadata: {
              hostname: srvRecord.data.target,
              weight: srvRecord.data.weight,
              priority: srvRecord.data.priority,
              peerId: serviceName, // 使用服务名称作为 peerId
            },
          };

          if (txtRecord && txtRecord.data) {
            const { data } = txtRecord;
            console.log("解析TXT记录:", data);
            const txtData = (Array.isArray(data) ? data : [data]).map((data) =>
              Buffer.isBuffer(data) ? data.toString() : data,
            );
            txtData.forEach((txt) => {
              try {
                const [key, value] = txt.split("=");
                if (key && value) {
                  newService.metadata[key] = value;
                }
              } catch (error) {
                console.error("解析TXT记录错误:", error);
              }
            });
          }

          console.log("创建新服务:", newService);
          this.services.set(newService.serviceName, newService);
          this.onServiceDiscovery.emit(newService);
        }
      } else if (answer.type === "SRV") {
        const [serviceName, serviceType, protocol] =
          answer.name?.split(".") || [];
        if (!serviceName || !serviceType || !protocol) return;

        const newService: ServiceDiscovery = {
          serviceName,
          serviceType: serviceType as ServiceType,
          port: answer.data.port,
          protocol: protocol === "local" ? serviceType : protocol, // 如果是 .local 则使用 serviceType
          metadata: {
            hostname: answer.data.target,
            weight: answer.data.weight,
            priority: answer.data.priority,
          },
        };

        // 查找相关的 TXT 记录以获取额外的元数据
        const txtRecord = response.answers.find(
          (answer) =>
            answer.type === "TXT" &&
            answer.name === `${serviceName}.${serviceType}.${protocol}`,
        ) as TxtAnswer | undefined;
        if (txtRecord && txtRecord.data) {
          const { data } = txtRecord;
          // 解析 TXT 记录中的元数据
          const txtData = (Array.isArray(data) ? data : [data]).map((data) =>
            Buffer.isBuffer(data) ? data.toString() : data,
          );
          txtData.forEach((txt) => {
            try {
              if (typeof txt === "string") {
                const [key, ...valueParts] = txt.toString().split("=");
                if (key && valueParts.length > 0) {
                  const value = valueParts.join("="); // 重新组合可能包含 = 的值
                  try {
                    newService.metadata[key] = JSON.parse(value);
                  } catch {
                    newService.metadata[key] = value;
                  }
                }
              }
            } catch (error) {
              console.error("Error parsing TXT record:", error);
            }
          });
        }

        // 检查是否已经知道这个服务
        const existingService = this.services.get(serviceName);
        if (!existingService) {
          // 发现新服务
          this.services.set(serviceName, newService);
          this.onServiceDiscovery.emit(newService);
        }
      }
    }
  }

  private handleQuery(query: mDNS.QueryPacket) {
    const questions = query.questions || [];
    const responses: mDNS.ResponseOutgoingPacket = { answers: [] };

    for (const question of questions) {
      const service = this.findServiceByQuestion(question);
      if (service) {
        responses.answers.push(...this.createResponseAnswers(service));
      }
    }
    if (responses.answers.length) {
      this.mdns.respond(responses);
    }
  }

  private findServiceByQuestion(
    question: Question,
  ): ServiceDiscovery | undefined {
    if (!question.name) return undefined;

    const name = question.name.toLowerCase();
    for (const service of this.services.values()) {
      // 构造标准的服务名称
      const serviceFullName =
        `_${service.serviceName}._${service.protocol}.local`.toLowerCase();
      if (name === serviceFullName) {
        return service;
      }
    }
    return undefined;
  }

  private createResponseAnswers(
    service: ServiceDiscovery,
  ): mDNS.ResponseOutgoingPacket["answers"] {
    const serviceName = `_${service.serviceName}._${service.protocol}.local`;
    const instanceName = `${
      service.metadata.peerId || service.serviceName
    }.${serviceName}`;

    // 准备 TXT 记录数据
    const txtRecords = Object.entries(service.metadata || {}).map(
      ([key, value]) => {
        const valueStr =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        return `${key}=${valueStr}`;
      },
    );

    return [
      {
        name: serviceName,
        type: "PTR",
        ttl: 120,
        data: instanceName,
      },
      {
        name: instanceName,
        type: "SRV",
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
        type: "TXT",
        ttl: 120,
        data: txtRecords,
      },
    ];
  }
  private createResponsePacket(
    service: ServiceDiscovery,
  ): Pick<mDNS.ResponseOutgoingPacket, "answers"> {
    return {
      answers: this.createResponseAnswers(service),
    };
  }

  // 发送 mDNS 查询
  public query(query: mDNS.QueryPacket) {
    console.log("发送 mDNS 查询:", query);
    this.mdns.query(query);
  }

  // 广播服务
  public broadcastService(service: ServiceDiscovery) {
    const packet = this.createResponsePacket(service);
    console.log("广播服务:", packet);
    this.mdns.respond(packet);
  }

  public registerService(service: ServiceDiscovery) {
    const serviceId = service.serviceName;

    // 确保服务名称和协议没有前缀下划线
    service.serviceName = service.serviceName.replace(/^_+/, "");
    service.protocol = service.protocol.replace(/^_+/, "");

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
