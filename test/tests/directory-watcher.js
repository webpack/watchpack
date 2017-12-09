'use strict';

/* globals describe it beforeEach afterEach */
const path = require('path');
const assert = require('assert');
const DirectoryWatcher = require('../../lib/DirectoryWatcher');
const TestHelper = require('../helpers/TestHelper');

const fixtures = path.join(__dirname, 'fixtures');
const testHelper = new TestHelper(fixtures);
const openWatchers = [];
const timings = {
  slow: 300,
  fast: 50
};

const TestWatcher = function dw(p, options) {
  const watcher = new DirectoryWatcher(p, options);
  const proxyClose = watcher.close;

  openWatchers.push(watcher);

  watcher.close = function close() {
    proxyClose.call(this);

    const index = openWatchers.indexOf(watcher);

    if (index < 0) {
      throw new Error('DirectoryWatcher was already closed');
    }

    openWatchers.splice(index, 1);
  };

  return watcher;
};

describe('DirectoryWatcher', () => {
  beforeEach(testHelper.before);
  afterEach(testHelper.after);
  afterEach(() => {
    openWatchers.forEach((watcher) => {
      console.log(`DirectoryWatcher (${watcher.path}) was not closed.`);
      watcher.close();
    });
  });

  it('should detect a file creation', (done) => {
    const watcher = new TestWatcher(fixtures, {});
    const a = watcher.watch(path.join(fixtures, 'a'));
    a.on('change', (mtime) => {
      assert(mtime, 'number');
      assert(Object.keys(watcher.getTimes()).sort(), [
        path.join(fixtures, 'a')
      ]);
      a.close();
      done();
    });
    testHelper.tick(() => {
      testHelper.file('a');
    });
  });

  it('should detect a file change', (done) => {
    const watcher = new TestWatcher(fixtures, {});
    testHelper.file('a');
    const a = watcher.watch(path.join(fixtures, 'a'));
    a.on('change', (mtime) => {
      assert(mtime, 'number');
      a.close();
      done();
    });
    testHelper.tick(() => {
      testHelper.file('a');
    });
  });

  it('should not detect a file change in initial scan', (done) => {
    testHelper.file('a');
    testHelper.tick(() => {
      const watcher = new TestWatcher(fixtures, {});
      const a = watcher.watch(path.join(fixtures, 'a'));
      a.on('change', () => {
        throw new Error('should not be detected');
      });
      testHelper.tick(() => {
        a.close();
        done();
      });
    });
  });

  it('should detect a file change in initial scan with start date', (done) => {
    const start = new Date();
    testHelper.tick(1000, () => {
      testHelper.file('a');
      testHelper.tick(1000, () => {
        const watcher = new TestWatcher(fixtures, {});
        const a = watcher.watch(path.join(fixtures, 'a'), start);
        a.on('change', () => {
          a.close();
          done();
        });
      });
    });
  }).timeout(4000);

  it('should not detect a file change in initial scan without start date', (done) => {
    testHelper.file('a');
    testHelper.tick(200, () => {
      const d = new TestWatcher(fixtures, {});
      const a = d.watch(path.join(fixtures, 'a'));
      a.on('change', (mtime, type) => {
        throw new Error(`should not be detected (${type} mtime=${mtime} now=${Date.now()})`);
      });
      testHelper.tick(() => {
        a.close();
        done();
      });
    });
  });

  Object.keys(timings).forEach((name) => {
    const time = timings[name];
    it(`should detect multiple file changes (${name})`, (done) => {
      const watcher = new TestWatcher(fixtures, {});
      testHelper.file('a');
      testHelper.tick(() => {
        const a = watcher.watch(path.join(fixtures, 'a'));
        let count = 20;
        let wasChanged = false;
        a.on('change', (mtime) => {
          assert(mtime, 'number');
          if (!wasChanged) return;
          wasChanged = false;
          if (count-- <= 0) { // eslint-disable-line no-plusplus
            a.close();
            done();
          } else {
            testHelper.tick(time, () => {
              wasChanged = true;
              testHelper.file('a');
            });
          }
        });
        testHelper.tick(() => {
          wasChanged = true;
          testHelper.file('a');
        });
      });
    }).timeout(10000);
  });

  it('should detect a file removal', (done) => {
    testHelper.file('a');
    const watcher = new TestWatcher(fixtures, {});
    const a = watcher.watch(path.join(fixtures, 'a'));
    a.on('remove', (mtime) => {
      if (process.platform === 'darwin') {
        assert(mtime, 'unlink');
      } else {
        assert((typeof mtime === 'undefined'), true);
      }

      a.close();
      done();
    });
    testHelper.tick(() => {
      testHelper.remove('a');
    });
  });
}).timeout(10000);
