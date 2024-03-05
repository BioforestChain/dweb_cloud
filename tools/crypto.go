package tools

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// 使用节点名称一起生成id
func GeneratorNodeId(name string) string {
	// 获取当前的时间
	now := time.Now()
	// 构造我们的输入数据
	data := fmt.Sprintf("%s%s", now.String(), name)

	// 生成 SHA256
	hash := sha256.Sum256([]byte(data))
	id := hex.EncodeToString(hash[:])
	fmt.Println("node id=>", id)
	return id
}
