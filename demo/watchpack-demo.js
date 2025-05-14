const path = require('path');
const Watchpack = require('../');
const fs = require('fs');

// 创建要监听的目录
const watchDir = path.join(__dirname, 'watch-test');

// 确保目录存在
if (!fs.existsSync(watchDir)) {
    fs.mkdirSync(watchDir, { recursive: true });
}

// 创建 Watchpack 实例
const wp = new Watchpack({
    // 配置选项
    aggregateTimeout: 1000,  // 聚合多个变化的延迟时间(ms)
    poll: false,            // 是否使用轮询模式
    followSymlinks: false,  // 是否跟踪符号链接
    ignored: ['**/node_modules/**', '**/.git/**']  // 忽略的文件模式
});

// 开始监听目录
wp.watch({
    directories: [watchDir],  // 要监听的目录列表
    missing: [],             // 要监听但可能不存在的文件列表
    startTime: Date.now()    // 开始时间，只监听这个时间之后的变化
});

// 监听变化事件
wp.on('change', (filePath, mtime, explanation) => {
    console.log('文件变化:', {
        file: filePath,
        mtime: new Date(mtime),
        type: explanation,
        time: new Date().toLocaleString()
    });
});

// 监听聚合事件（当多个变化在 aggregateTimeout 时间内发生时触发）
wp.on('aggregated', (changes, removals) => {
    console.log('聚合变化:', {
        changes: Array.from(changes),    // 变化的文件列表
        removals: Array.from(removals),  // 删除的文件列表
        time: new Date().toLocaleString()
    });
});

console.log(`开始监听目录: ${watchDir}`);
console.log('你可以在该目录下进行以下操作来测试:');
console.log('1. 创建新文件');
console.log('2. 修改现有文件');
console.log('3. 删除文件');
console.log('4. 创建/删除子目录');

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n停止监听...');
    wp.close();
    process.exit();
});

// 保持进程运行
process.stdin.resume();

console.log('\n提示: 按 Ctrl+C 退出程序'); 