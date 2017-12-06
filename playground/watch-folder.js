'use strict';

const path = require('path');
const Watchpack = require('../');

const folder = path.join(__dirname, 'folder');
const log = console.log; // eslint-disable-line no-console

function startWatcher(name, files, folders) {
  const w = new Watchpack({
    aggregateTimeout: 3000
  });

  w.on('change', (file, mtime) => {
    log(name, 'change', path.relative(folder, file), mtime);
  });

  w.on('aggregated', (changes) => {
    const times = w.getTimes();
    log(name, 'aggregated', changes.map(file => path.relative(folder, file)), Object.keys(times).reduce((obj, file) => {
      obj[path.relative(folder, file)] = times[file];
      return obj;
    }, {}));
  });

  const startTime = Date.now() - 10000;
  log(name, startTime);
  w.watch(files, folders, startTime);
}

startWatcher('folder', [], [folder]);
startWatcher('sub+files', [
  path.join(folder, 'a.txt'),
  path.join(folder, 'b.txt'),
  path.join(folder, 'c.txt'),
  path.join(folder, 'd.txt')
], [
  path.join(folder, 'subfolder')
]);
