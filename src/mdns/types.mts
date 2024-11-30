// 服务类型定义
export type ServiceType = 
  | "http"      // HTTP服务
  | "https"     // HTTPS服务
  | "tcp"       // 普通TCP服务
  | "udp"       // UDP服务
  | "dns"       // DNS服务
  | "ssh"       // SSH服务
  | "ftp"       // FTP服务
  | "smtp"      // 邮件服务
  | "database"  // 数据库服务
  | "vm"        // 虚拟机服务
  | "script";   // 脚本服务

// 服务元数据接口
export interface ServiceMetadata {
  // 通用元数据
  version?: string;           // 服务版本
  environment?: string;       // 运行环境
  description?: string;       // 服务描述
  owner?: string;            // 服务所有者
  hostname?: string;         // 服务主机名
  
  // 健康检查相关
  healthEndpoint?: string;   // 健康检查端点
  healthTimeout?: string;    // 健康检查超时时间
  healthInterval?: string;   // 健康检查间隔
  
  // HTTP/HTTPS 特定配置
  https?: string;           // 是否使用HTTPS
  baseUrl?: string;        // 基础URL
  apiVersion?: string;     // API版本
  
  // 数据库特定配置
  database?: string;       // 数据库名称
  dbUser?: string;        // 数据库用户
  dbType?: string;        // 数据库类型
  
  // 其他配置
  region?: string;        // 服务区域
  weight?: string;        // 服务权重
  tags?: string;          // 服务标签（逗号分隔）
  [key: string]: string | undefined;  // 允许其他自定义元数据
}

// 服务发现接口
export interface ServiceDiscovery {
  serviceName: string;        // 服务名称
  serviceType: ServiceType;   // 服务类型
  port: number;              // 服务端口
  protocol: string;          // 使用的协议
  metadata: ServiceMetadata; // 服务元数据
}

// 服务健康状态接口
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';  // 健康状态：健康、不健康、未知
  lastCheck: Date;                              // 最后检查时间
  uptime: number;                               // 运行时间（秒）
  metrics: {
    responseTime: number;                       // 响应时间（毫秒）
    successRate: number;                        // 成功率（0-1）
  };
}

// 从multicast-dns导入类型
import type { ResponsePacket, QueryPacket } from "multicast-dns";

// 远程信息接口
export interface RemoteInfo {
  address: string;    // 远程地址
  family: 'IPv4' | 'IPv6';  // IP协议版本
  port: number;      // 远程端口
  size: number;      // 数据包大小
}

// 事件类型定义
export interface MdnsEvents {
  'response': (response: ResponsePacket) => void;                    // 收到响应时触发
  'query': (query: QueryPacket, rinfo: RemoteInfo) => void;         // 收到查询时触发
  'error': (error: Error) => void;                                  // 发生错误时触发
  'ready': () => void;                                              // 服务就绪时触发
  'service-discovery': (service: ServiceDiscovery) => void;         // 发现新服务时触发
  'service-lost': (service: ServiceDiscovery) => void;              // 服务丢失时触发
  'health-check': (data: { serviceId: string; health: ServiceHealth }) => void;  // 健康检查完成时触发
}