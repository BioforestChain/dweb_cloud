package node

import (
	"dweb-cloud/tools"
)

type DNode struct {
	id   string  // 每个节点的ID 在网络中唯一
	uid  string  //  部署节点的用户ID公钥
	Name string  // 节点名称
	Fee  float32 // 费用，会根据市场供需关系，设定价格，用户也可以自行设置
	Url  string  // 部署服务的访问地址
}

func NewDNode(name string, uid string) DNode {
	id := tools.GeneratorNodeId(name)
	return DNode{
		id:   id,
		uid:  uid,
		Name: name,
	}
}
