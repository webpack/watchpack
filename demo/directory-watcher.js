const path = require('path');
const DirectoryWatcher = require('../lib/DirectoryWatcher');
const getWatcherManager = require('../lib/getWatcherManager');

// Create a test directory to watch
const watchDir = path.join(__dirname, 'watch-test');

// Create a DirectoryWatcher instance
const watcher = new DirectoryWatcher(getWatcherManager({}), watchDir, {});

// Watch the entire directory
const directoryWatcher = watcher.watch(watchDir);

// Listen for changes
directoryWatcher.on('change', (filePath, mtime, type, initial) => {
    console.log('Change detected:', {
        file: filePath,
        mtime: new Date(mtime),
        type,
        initial
    });
});

// Listen for file/directory removals
directoryWatcher.on('remove', (type) => {
    console.log('Remove detected:', {
        type
    });
});

// Listen for initial missing files/directories
directoryWatcher.on('initial-missing', (type) => {
    console.log('Initial missing:', {
        type
    });
});

console.log(`Watching directory: ${watchDir}`);
console.log('You can now make changes to the directory to see the events:');
console.log('1. Create new files');
console.log('2. Modify existing files');
console.log('3. Delete files');
console.log('4. Create/delete directories');

// Keep the process running
process.stdin.resume();

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\nClosing watcher...');
    directoryWatcher.close();
    watcher.close();
    process.exit();
}); 