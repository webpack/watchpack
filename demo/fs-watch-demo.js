const fs = require('fs');
const path = require('path');

// 创建要监听的目录
const watchDir = path.join(__dirname, 'watch-test');

// 确保目录存在
if (!fs.existsSync(watchDir)) {
    fs.mkdirSync(watchDir, { recursive: true });
}

console.log(`开始监听目录: ${watchDir}`);
console.log('你可以在该目录下进行以下操作来测试:');
console.log('1. 创建新文件');
console.log('2. 修改现有文件');
console.log('3. 删除文件');
console.log('4. 创建/删除子目录');

// 监听目录变化
const watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
    if (filename) {
        const filePath = path.join(watchDir, filename);
        console.log('检测到变化:', {
            event: eventType,        // 'rename' 表示创建/删除文件，'change' 表示修改文件
            file: filename,
            fullPath: filePath,
            time: new Date().toLocaleString()
        });

        // 检查文件是否存在来判断是创建还是删除
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.log(`文件被删除: ${filename}`);
            } else if (eventType === 'rename') {
                console.log(`新文件被创建: ${filename}`);
            }
        });
    }
});

// 处理错误
watcher.on('error', (error) => {
    console.error('监听错误:', error);
});

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n停止监听...');
    watcher.close();
    process.exit();
});

// 保持进程运行
process.stdin.resume();

console.log('\n提示: 按 Ctrl+C 退出程序'); 