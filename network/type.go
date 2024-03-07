package network

import "dweb-cloud/node"

type TNode node.DNode

// 节点树🌲
type TRouterTree struct {
	Name     string
	Children []TNode
}
