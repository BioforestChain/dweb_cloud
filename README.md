# Dweb-Cloud

[提案](./proposals.md)

## Example

```bash
# 启动网关
npx tsx ./src/gateway.mts --host gaubee.local --port 8080
# 启动服务，注册到网关中
npx tsx ./demo/service.demo.mts --gateway=http://gaubee.local:8080/ --secret=qaq

# 然后就可以打开链接查看 http://7t3pkjces1xki1ppen9dzvdbpinayy8uk-gaubee.local:8080/test
```

## How to Use

1. Install CLI
   ```bash
   npm install -g @dweb-cloud/cli
   ```
2. Start Gateway Service
   - local
   ```bash
   dweb-cloud dev USER_NAME.local
   # --port -p = 80 custom port
   # --host -h = 0.0.0.0 custom host
   ```
   - deploy
   ```bash
   dweb-cloud start SERVER_HOST_NAME
   # --port -p = 443 custom port
   # --host -h = 0.0.0.0 custom host
   ```
3. Registry MicroService

   ```ts
   import { registry } from "@dweb-cloud/client";

   const keypair = process.env.BIOFOREST_CHAIN_SECRET;

   const packet = registry({
     /** dweb-cloud 网关 */
     gateway: "http://gaubee.local:8080",
     /** 认证算法，目前仅仅支持 bioforestchain 的标准(也是比特币的标准)，未来会加入 web3 的标准 */
     algorithm: "bioforestchain",
     /** 密钥，私钥会用于签名，公钥会用于上传、以及生成要注册的域名 */
     keypair: secret,
     service: {
       /**
        * 网络模式
        * 那么网关就是负责进行请求转发
        */
       mode: "http",
       hostname: "127.0.0.1",
       port: process.env.SERVICE_PORT,
     } || {
       /**
        * TODO: VM模式
        * dweb-cloud 会在一个 vm 中启动程序，并使用 dweb-ipc 建立连接，替代 http 协议
        * 模块之间通讯性能会更好
        * 支持 http[s] 的文件入口，与 web 的标准一致
        */
       mode: "vm",
       type: "script" | "module",
       href: process.env.SERVICE_SCRIPT,
     },
   });

   /// 发送数据包
   const res = await fetch(packet.url, {
     method: packet.method,
     headers: packet.headers,
     body: packet.body,
   }).then((r) => r.text());
   ```
