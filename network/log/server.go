package log

import (
	"io/ioutil"
	"net/http"
	"os"

	"github.com/natefinch/lumberjack" // 帮助管理log
	"github.com/sirupsen/logrus"      // 处理json
)

var log = logrus.New()

// json 文件类型的log
type fileJsonLog string

// 写入文件 // TODO 这里应该创建一个写文件的抽象工厂，并且实现写入本地，写入云端的实现
func (fl fileJsonLog) Write(data []byte) (int, error) {
	// 打开文件句柄,创建/只写入/追加
	f, error := os.OpenFile(string(fl), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if error != nil {
		return 0, error
	}
	defer f.Close()
	return f.Write(data)
}

// 创建一个新的log
func Create(destination string) {
	log.SetFormatter(&logrus.JSONFormatter{})
	// 滚动记录
	log.SetOutput(&lumberjack.Logger{
		Filename:   destination,
		MaxSize:    500, // megabytes
		MaxBackups: 3,
		MaxAge:     28, //days
		Compress:   true,
	})
}

// 注册日志操作
func RegisterHandles() {
	http.HandleFunc("/log", func(w http.ResponseWriter, r *http.Request) {
		// 这里会在header 携带节点信息
		switch r.Method {
		case http.MethodPost:
			msg, err := ioutil.ReadAll(r.Body)
			if err != nil || len(msg) == 0 {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			write(string(msg))
		default:
			w.WriteHeader(http.StatusNotFound)
			return
		}

	})
}

// 写入日志
func write(message string) {
	log.WithFields(logrus.Fields{
		"message": message,
	}).Info()
}
