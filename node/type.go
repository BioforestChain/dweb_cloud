package node

// 节点状态，用来当作网络判断的权重指标 节点状态由网络计算动态更新
type TStatus struct {
	Fps    uint8   // 网络延迟
	DisNum uint8   // 离线次数
	Fee    float32 // 费用，会根据市场供需关系，设定价格，用户也可以自行设置
	Pledge uint16  // 节点质押，高权重
}
