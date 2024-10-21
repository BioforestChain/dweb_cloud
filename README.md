## dweb-dapp + dweb-cloud 编程范式

dweb-dapp 是一种可以部署在 dweb-engine（比如 dweb-browser）内的应用。
dweb-cloud 也是一种 dweb-engine，它与 dweb-browser 的本质差别在于：dweb-browser 运行在端侧，而 dweb-cloud 运行在云上集群中。

dweb-dapp 强调边缘计算、私有化部署、点对点直连。而在现代的端侧硬件体系中，这显然偏向于理想化，因为移动设备中强调节约功耗，一切资源消耗主要是针对用户的自动需求。因此我们引入了 dweb-cloud 这个计算平台，作为 dweb-browser 的一个云端影子，解决 dweb-browser 硬件体系的缺陷，为 dweb-dapp 提供一个完整运行完整体。
但我们不否定，未来随着 dweb-os 的操作系统研发+以及配套的移动硬件+基础设施的建设与合作，我们极有可能完成对 dweb-browser 与 dweb-cloud 进一步深度整合。

而在此之前，这里将定义一种 dweb-dapp 的专属编程范式，来简化这种愿景的落地难度。

#### 与传统 C/S 的对比

与传统 Client+Server（客户端+服务端）的开发理念不同，传统开发是一种中心化视角，以一个 CMS 平台为例，在 C/S 架构中，需要在 S 侧建立 User 表（用户表）、Admin 表（管理员权限表）、Blog 表（内容表），每个 User 可以 Query/Add/Update/Delete Blog（增删改查）。在开发人员的视角看来，就是需要定一个 BlogService，然后提供这些接口给 User 用于管理他们自己的数据，同时还要提供接口给 Admin 用于管理所有人的数据。
可以看到 S 侧就是一个上帝视角，C 侧则是面向不同的角色做不同的界面，然后统一到一个 S 侧，通过不同的接口完成 C 侧的功能。

> 这里假定本章的阅读者拥有基本的 C/S 开发经验，但是为了方便对比，这里给出伪代码。

```ts
class BlogService {
  login(account: string, password: string): { userToken: string };
  /** 获取内容 */
  query(userToken: string, searchKeyWords?: Array<string>): BlogPage;
  /** 添加内容 */
  post(
    userToken: string,
    metadata: Record<string, string>,
    content: string
  ): Blog;
  /** 修改内容 */
  put(userToken: string, blog: Blog): Blog;
  /** 删除内容 */
  delete(userToken: string, blogId: string): boolean;
}

class BlogAdminService {
  login(account: string, password: string): { adminToken: string };
  /** 获取内容 */
  query(adminToken: string, searchKeyWords?: Array<string>): BlogPage;
  /** 审核不通过，提供拒绝理由 */
  reject(adminToken: string, blogId: string, reason: string): boolean;
  /** 审核通过，发布内容 */
  publish(adminToken: string, blogId: string): boolean;
  /** 撤回内容 */
  unpublish(adminToken: string, blogId: string): boolean;
  /** 删除内容 */
  delete(adminToken: string, blogId: string): boolean;
}
```

在 dweb-dapp 的开发则是相反的，这里我们更换了术语，使用 Peer（节点）来对比 C/S。
开发人员始终是站在 P 侧来进行开发的。因此一开始在 User 角度看来，已经存在一张 Blog 表，这张表专属于 P 侧的每一个 User，并不共享。
然后在 P 侧有一个 Blog Plaza（内容广场）的页面，这里汇聚着所有的博文，为了管理这个广场，我们需要有一个审核人员，对要进入 Blog Plaza 的内容进行审核，因此 User 在写完博文后，需要对博文进行上传，上传到 Admin 的 Peer 上，Admin 有自己的 Blog 表，User 可以通过与 Admin 的连接，将 Blog 插入到 Admin 到 Blog 表中，但处于未审核的状态，等到 Admin 审核完成，再将这条 Blog 标记成审核通过，那么它就出现在 Blog Plaza 上了。其它所有订阅这个 Blog Plaza 的 Peer 都能 Query 到这张表的更新。

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

总结一下两种架构的区别，C/S 架构设计通常是从“登录”这个概念开始，基于登录来获得对接口的一些操作权限，从而能影响数据库。
而 dweb-dapp 的编程理念则是淡化甚至取消了“登录”这个概念，由通用的密钥管理器或者本地授权登录来取代身份认证。
同时 dweb-dapp 对数据库的使用是从私有视角的数据库出发，因此使用起来更符合直觉，不需要考虑和其它人共享一个表所带来的权限管理、数据篡改等安全问题。

因此默认情况下，使用 dweb-dapp 的编程范式，主要的思维方式就是从“某一个角色出发，解决这个角色的需求”，如果有多个角色互动，那么就意味着多个角色之间会有一个“裁判”的角色，来确保这个互动的正确性，因此我们又回到了面向这个“裁判”来进行编程。这种面向某一个角色的思维方式，就是我们一直强调的“Peer”这个单词。
因此我们需要做的就是找到 Peer、为 Peer 做开发、部署 Peer 到某一个 dweb-engine 中。

#### 开发方式

- blog.controller.ts

```ts
import { Table } from "@dweb-browser/cloud";

/** 管理私有内容 */
export class BlogController {
  #table = new Table<Blog>("blog", {
    searchConfig: ["content", "title", "createdTime"],
    index: ["createdTime"],
  });
  /** 获取内容 */
  query(searchKeyWords?: Array<string>) {
    const page: Table.Page<Blog> = this.#table.search(searchKeyWords);
    return page;
  }
  /** 添加内容 */
  add(metadata: Record<string, string>, content: string) {
    const blog: Blog = this.#table.insert({ metadata, content });
    return blob;
  }
  /** 修改内容 */
  update(blog: Blog): Blog {
    const blog: Blog = this.#table.update(blog);
    return blob;
  }
  /** 删除内容 */
  delete(blogId: string) {
    const success: boolean = this.#table.delete(blog);
    return success;
  }
}
```

以上这段代码在 dweb-browser 中运行后，内部的编译器会对这段代码进行重新理解并编译，然后自动将代码部署到 dweb-cloud 中，那么会返回一个 url：`https://dweb-cloud.com.dweb/xxx-xxx-xxx-uuid/blog.controller.ts`, 在 dweb-browser 侧通过 import 来导入这个代码，那么背后发生了两个事情：

1. 个是本地会有一个 SQLite 数据库，来实现数据的离线的、离散的存储。
2. 同时在 dweb-cloud 会自动部署一个完整的数据库，实现完整的存储。

在使用 BlogController 对数据库进行插入时，会优先插入本地 SQLite 数据库，同时向云端做同样的动作，这里全程使用 CRDT 进行本地和云端的协同作业。

> 因为 dweb-cloud 是完全开源的，因此开发者可以自己在个人服务器或者个人电脑上部署这个服务，再通过配置，将 dweb-browser 中 dweb-cloud.com.dweb 路由到个人私有平台上，从而实现完全的私有化 dweb-dapp 部署。
>
> > 注意：私有化部署的时候，您可能会将服务分享给身边的人使用，请遵守本地法律法规。或者您可能会使用他人分享给你的私有化服务，请务必注意个人数据的安全性问题。

> dweb-cloud 支持在 dweb-browser 中部署。但默认会使用云端服务，目的是为了确保更好的用户体验的，用户可以调整链路优先级来改变这个情况。
>
> 但要注意，不同的 dweb-engine 运行在不同的硬件环境下，dweb-browser 因为运行在不同平台上，因此有些功能可能是确实缺失且无法模拟的，这时候会不得不使用 dweb-cloud 来补全依赖环境。
>
> 您可以选择私有化部署，但通常情况下 dweb-cloud 因为多方面的优化，在综合成本上是最划算的。

> > 注意：当 dweb-cloud 与 dweb-browser 是主从关系时，dweb-browser 作为“从数据库”（使用本地 SQLite 数据库）是离散存储的，会根据用户综合数据使用习惯和存储限制，自动对数据进行清理。但用户也可以通过主动配置，让部分数据完全离线存储在本地设备
> >
> > 我们也支持多档位的链路，比如依次将 “移动设备的 dweb-browser”、“PC 设备的 dweb-browser”、dweb-cloud 联合成一个链路，这样可以更好的节约成本，利用个人设备的闲置资源，但代价是最长延迟会增加。

#### 工作原理

参考 @dweb-browser/jRPC ，可以实现远程执行其它设备上的 JS 代码。
