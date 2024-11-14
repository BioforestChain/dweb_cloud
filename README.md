# Dweb-Cloud

[提案](./proposals.md)

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
   import { registry, signRequestWithBody } from "@dweb-cloud/client";

   const keypair = process.env.BIOFOREST_CHAIN_SECRET;

   const { url, body } = registry({
     /** dweb-cloud 网关 */
     gateway: "http://localhost:80",
     /** 认证，会根据认证方式获得不同的域名 */
     auth: {
       /**生物链林的密钥标准 */
       mode: "BioforestChain",
       publicKey: keypair.publicKey,
     },
     service: {
       /**
        * 端口模式
        * 假设您的服务通过 http 协议启动在某个端口下
        */
       port: process.env.SERVICE_PORT,
     } || {
       /**
        * VM模式
        * dweb-cloud 会在一个 vm 中启动程序，并使用 dweb-ipc 建立连接，替代 http 协议
        * 模块之间通讯性能会更好
        * 支持 http[s] 的文件入口
        */
       script: process.env.SERVICE_SCRIPT,
     },
   });

   const headers = signRequestWithBody(keypair.privateKey);
   ```
