package node

import (
	"dweb-cloud/tools"
)

type DNode struct {
	Id       string  // 每个节点的ID 在网络中唯一
	uid      string  //  部署节点的用户ID公钥
	Name     string  // 节点名称
	service  string  // 服务类型，网络中的用户通过这个服务类型注册到网络中提供相应的服务
	Url      string  // 部署服务的访问地址
	Status   TStatus // 节点状态，用来当作网络判断的权重指标
	Children []*DNode
}

func NewDNode(name string, uid string, service string) DNode {
	id := tools.GeneratorNodeId(name)
	return DNode{
		Id:      id,
		uid:     uid,
		service: service,
		Name:    name,
	}
}
