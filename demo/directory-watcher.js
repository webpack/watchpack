const path = require('path');
const DirectoryWatcher = require('../lib/DirectoryWatcher');
const getWatcherManager = require('../lib/getWatcherManager');

// Create a test directory to watch
const watchDir = path.join(__dirname, 'watch-test');

const fs = require('fs');

if (!fs.existsSync(watchDir)) {
    fs.mkdirSync(watchDir, { recursive: true });
}

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
