# dweb-cloud

dweb-cloud 是一个 js 容器，为 dweb-dapp 的端侧运行提供持久化的运行服务。

## dweb-dapp + dweb-engine 编程范式

dweb-dapp 是一种可以部署在 dweb-engine（比如 dweb-browser）内的应用。
dweb-cloud 也是一种 dweb-engine，它与 dweb-browser 的本质差别在于：dweb-browser 运行在端侧，提供端侧系统级别的能力，因此更多的是为应用提供输入输出的能力。
而 dweb-cloud 可以运行在 云上集群或者个人设备中，主要用于为应用提供“存储”、“计算”、“网络”的能力。

dweb-dapp 对于“存储”、“计算”、“网络”的要求是强调“私有化存储”、“边缘计算”、“点对点直连”。
而在现代的端侧硬件体系中，这显然偏向于理想化，因为移动设备中非常重视节约功耗，资源消耗主要是服务于用户的主动需求。因此我们引入了 dweb-cloud 这个云平台，作为运行 dweb-app 的一个辅助，解决 dweb-browser 硬件体系的缺陷，为 dweb-dapp 提供一个更加完整的运行时。
但我们不否定，未来随着 dweb-os 的操作系统研发+以及配套的移动硬件+基础设施的建设与合作，我们极有可能完成对 dweb-browser 与 dweb-cloud 进一步深度整合，让用户在购买 dweb-os 设备的时候就已经完成所有直接成本的支付。

而在此之前，这里将定义一种 dweb-dapp 的专属编程范式，来简化这种愿景的落地难度。

#### 为什么使用 dweb-dapp 标准来承载产品？与传统 C/S 的对比

正如上文所提到的，想要开发一个功能健全的应用，需要企业同时提供服务端和客户端，客户的数据主要存储在服务端，客户端只是一个用于建立服务端和客户需求的桥梁。

而 dweb-dapp 的理念与此不同，应用的功能直接运行在“节点”上，不论是客户端还是服务端，都是运行在节点上，也就是说在 dweb-dapp 开发中，我们将一切“端侧”统称为“节点”，在一个 dweb-dapp 中，我们通常会根据“角色”来定义“节点”，也可以根据“功能模块”来定义“节点”，节点之间通过互信互联，来给用户呈现完整的应用体验。
使用 dweb-dapp 开发，企业或者独立开发者可以极大节约运维成本，用户也因为边缘计算的理念，得到了响应更加极速的应用体验。甚至可以说，使用 dweb-dapp 的编程范式，可以缩短开发周期，实现更快速的迭代。

以一个 CMS 平台为例，在传统 Client+Server（客户端+服务端）的开发理中，开发者使用一种中心化视角，以 Server 侧（下文简称 “S”）为中心、以 Client 侧（下文简称“C”）为数据的输入输出口。需要在 S 建立 User 表（用户表）、Admin 表（管理员权限表）、Blog 表（内容表），让每个 User 可以 Query/Add/Update/Delete Blog（增删改查）。在开发人员的视角看来，就是需要定一个 BlogService，然后提供这些接口给 User 用于管理他们自己的数据，同时还要提供接口给 Admin 用于管理所有人的数据。
可以看到，S 就是一个上帝视角，掌握着所有的资源，同时 C 的作用是为的用户角色做不同的使用界面，让用户通过这些界面来管理 S 的数据。

> 这里假定本章的阅读者拥有基本的 C/S 开发经验，但是为了方便对比，这里给出伪代码。

```yaml
# 用户登录
- https://api.com/user/login
# 用户获取内容
- https://api.com/user/blog/query
# 用户添加内容
- https://api.com/user/blog/add
# 用户修改内容
- https://api.com/user/blog/update
# 用户删除内容
- https://api.com/user/blog/delete

# 管理员登录
- https://api.com/admin/login
# 管理员获取内容
- https://api.com/admin/blog/query
# 管理员审核，拒绝内容，提供拒绝理由
- https://api.com/admin/blog/reject
# 管理员审核，审核内容通过
- https://api.com/admin/blog/update
# 管理员删除内容
- https://api.com/admin/blog/delete
```

然后我们再来看在 dweb-dapp 中的开发，使用 Peer（节点，下文简称“P”）来对比 C/S：
开发人员始终是站在 P 来进行开发的。因此一开始在“用户的 P”（下文简称 UP）已经具备了应用使用 Blog 的基本功能，至此不需要任何的服务器部署成本。
然后在 UP 的页面里，有一个 Blog Plaza（内容广场），这里汇聚着所有的 Blog，为了管理这个广场，我们需要有一个审核人员的角色，来对要进入 Blog Plaza 的内容进行审核，因此这时候我们需要新增一个“审核人员的 P”（下文简称 AP）。
也就是说，User 在写完 Blog 后，需要与 AP 进行直连，将 Blog 发送到 AP 的设备上，保存到 AP 自有的 Blog 表中，等到 AP 审核完成，再将这条 Blog 推送到广场上。那么其它所有订阅这个 Blog Plaza 的 Peer 都能收到这次订阅更新了。

以下是相关伪代码：

1. User Peer

   ```ts
   /** 管理私有内容 */
   class BlogController {
     /** 获取内容 */
     query(searchKeyWords?: Array<string>): BlogPage;
     /** 添加内容 */
     add(metadata: Record<string, string>, content: string): Blog;
     /** 修改内容 */
     update(blog: Blog): Blog;
     /** 删除内容 */
     delete(blogId: string): boolean;
   }
   /** 内容广场的服务窗口 */
   class BlogPlazaService {
     /** 获取内容 */
     query(searchKeyWords?: Array<string>): BlogPlazaPage;
     /** 查询审核状态 */
     getOrder(orderId: string): ReviewOrder;
     /** 发表内容 */
     postOrder(blog: Blog): ReviewOrder;
     /** 撤回发表 */
     revokePost(orderId: string): ReviewOrder;
     /** 审核状态发生了变化 */
     onReviewOrderChanged: PureEvent<ReviewOrder>;
   }
   ```

1. Admin Peer
   ```ts
   /** 管理内容广场 */
   class BlogPlazaController {
     /** 获取内容 */
     query(searchKeyWords?: Array<string>): BlogPlazaPage;
     /** 审核不通过，提供拒绝理由 */
     reject(blogId: string, reason: string): boolean;
     /** 审核通过，发布内容 */
     publish(blogId: string): boolean;
     /** 撤回内容 */
     unpublish(blogId: string): boolean;
     /** 删除内容 */
     delete(blogId: string): boolean;
   }
   ```

可以看的出来，dweb-dapp 到 Peer 开发理念，其实更符合现实生活中人与人的交互直觉。
这种编程范式下，数据往往更加安全，应用往往更可靠，开发成本往往更低。

> 因为你会发现，这个 UP 的 Blog 应用，其实与 AP 并没有直接关系，只是有这么一个 Blog Plaza 页面需要用到 AP 来查询数据。
> 也就是说，如果未来有其它的 Blog Plaza 专注于不同的分类（比如自然、新闻、科学、艺术、生物等不同领域），你通常并不需要额外开发一个 Blog 应用，而只需要做好这个 Blog Plaza 界面就好。
> 用户也不用担心自己的数据会被下架，至少在自己的应用里，它始终存在，投稿渠道也能更加多元化。

#### 开发方式

- blog.controller.ts

```ts
import { Table } from "@dweb-cloud/table";

/** 管理私有内容 */
export class BlogController {
  #table = new Table<Blog>("blog", {
    searchConfig: ["content", "title", "createdTime"],
    index: ["createdTime"],
  });
  /** 获取内容 */
  async query(searchKeyWords?: Array<string>) {
    const page: Table.Page<Blog> = await this.#table.search(searchKeyWords);
    return page;
  }
  /** 添加内容 */
  async add(metadata: Record<string, string>, content: string) {
    const blog: Blog = await this.#table.insert({ metadata, content });
    return blob;
  }
  /** 修改内容 */
  async update(blog: Blog): Blog {
    const blog: Blog = await this.#table.update(blog);
    return blob;
  }
  /** 删除内容 */
  async delete(blogId: string) {
    const success: boolean = await this.#table.delete(blog);
    return success;
  }
}
```

以上这段代码在 dweb-browser 中运行后，内部的编译器会对这段代码进行重新理解并编译，然后自动将代码部署到 dweb-cloud 中，并返回一个 url：`https://dweb-cloud.com.dweb/{peerAddress}/{dappId}/{versionOrHash}/{srcPath}/blog.controller.ts`, 在 dweb-browser 侧通过 import 来导入这个代码，那么背后发生了两个事情：

1. 个是本地会有一个 SQLite 数据库，来实现数据的离线的、离散的存储。
2. 同时在 dweb-cloud 会自动部署一个完整的数据库，实现完整的存储。

在使用 BlogController 对数据库进行插入时，会优先插入本地 SQLite 数据库，同时向云端做同样的动作，这里全程使用 CRDT 进行本地和云端的协同作业。

因为 dweb-cloud 是完全开源的，因此开发者可以自己在个人服务器或者个人电脑上部署这个服务，再通过配置，将 dweb-browser 中 dweb-cloud.com.dweb 路由到个人私有平台上，从而实现完全的私有化 dweb-dapp 部署。

> 注意：私有化部署的时候，您可能会将服务分享给身边的人使用，请遵守本地法律法规。或者您可能会使用他人分享给你的私有化服务，请务必注意个人数据的安全性问题。

dweb-cloud 支持在 dweb-browser 中部署。但默认会使用云端集群来承载服务，目的是为了确保更好的用户体验的，用户可以调整链路优先级来改变这个情况。

> 注意：因为 dweb-engine 可以运行在不同的硬件环境下，比如 dweb-cloud 因为运行在不同平台上，因此有些功能可能是缺失的且无法模拟的、或者没有足够的硬件资源来运行这些功能，这时候就会不得不使用云端集群来补全依赖环境。

虽然您可以选择私有化部署，但通常情况下官方的集群经过多方面的优化，在综合成本上是最划算的。

> 注意：当 dweb-cloud 与 dweb-browser 是主从关系时，dweb-browser 作为“从数据库”（使用本地 SQLite 数据库）是离散存储的，会根据用户综合数据使用习惯和存储限制，自动对数据进行清理。但用户也可以通过主动配置，让部分数据完全离线存储在本地设备

我们也支持多档位的链路，比如依次将 “移动设备的 dweb-browser 上的 dweb-cloud”、“PC 设备的 dweb-browser 上的 dweb-cloud”、“云端集群的 dweb-cloud” 联合成一个链路，这样可以更好的节约成本，利用个人设备的闲置资源，但代价是最长延迟会增加。

#### 工作原理

参考 [@dweb-browser/jRPC]()，可以实现远程执行其它设备上的 JS 代码。
