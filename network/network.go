package network

// 定义网络结构
type Network struct {
	hash        string                 // 网络节点hash
	RouterTrees map[string]TRouterTree // 表示提供当前服务的节点
}

func (net *Network) add(node TNode) {

}
