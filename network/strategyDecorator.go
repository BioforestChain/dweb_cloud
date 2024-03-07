/// 策略装饰器

package network

import "container/list"

// 广度优先搜索查找最近的费用最低的节点服务
func (net *Network) BfsFindDecorator(service string, strategyFn func(node *TNode) bool) *TNode {
	serviceTree := net.RouterTrees[service]
	var target *TNode
	// 避免循环查找
	visited := make(map[string]bool)
	// 使用双向链表作为队列
	queue := list.New()
	for _, node := range serviceTree.Children {
		queue.PushBack(node)
	}
	// 广度优先搜索
	for queue.Len() > 0 {
		// 出队操作
		element := queue.Front()
		queue.Remove(element)
		node := element.Value.(*TNode)
		if !visited[node.Id] {
			if strategyFn(node) {
				target = node
			} else {
				visited[node.Id] = true
				// 将子节点入队
				for _, child := range node.Children {
					queue.PushBack(child)
				}
			}
		}
	}
	return target
}
