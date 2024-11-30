import os from "node:os";

export interface NetworkInterface {
  address: string;
  netmask: string;
  masterAddress: number;
}

const pow24 = Math.pow(2, 24);
const pow16 = Math.pow(2, 16);
const pow8 = Math.pow(2, 8);

/**
 * 将IP地址转换为数字
 */
const ipToNumber = (ip: string): number => {
  const [a, b, c, d] = ip.split(".").map(Number);
  return a * pow24 + b * pow16 + c * pow8 + d;
};

/**
 * 获取主地址
 */
const getMasterAddress = (networkInterface: { address: string; netmask: string }): number => {
  const ip = ipToNumber(networkInterface.address);
  const netmask = ipToNumber(networkInterface.netmask);
  return ip & netmask;
};

/**
 * 获取所有IPv4网络接口列表
 */
export const getWlanIpv4List = (): NetworkInterface[] => {
  const ipv4List: NetworkInterface[] = [];
  
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
