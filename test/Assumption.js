'use strict';

/* globals describe it beforeEach afterEach */
/* eslint no-plusplus: off, no-undefined: off */
require('should');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const TestHelper = require('./helpers/TestHelper');

const fixtures = path.join(__dirname, 'fixtures');
const testHelper = new TestHelper(fixtures);

describe('Assumption', function desc() {
  this.timeout(10000);
  let watcherToClose = null;

  beforeEach(testHelper.before);
  afterEach((done) => {
    if (watcherToClose) {
      watcherToClose.close();
      watcherToClose = null;
    }
    testHelper.after(done);
  });

  it('should have a file system with correct mtime behavior (stats)', function _test(done) {
    this.timeout(20000);
    let i = 60;
    const count = 60;
    let minDiffBefore = +Infinity;
    let maxDiffBefore = -Infinity;
    let sumDiffBefore = 0;
    let minDiffAfter = +Infinity;
    let maxDiffAfter = -Infinity;
    let sumDiffAfter = 0;
    testHelper.tick(100, function checkMtime() {
      const before = Date.now();
      testHelper.file('a');
      const after = Date.now();
      const s = fs.statSync(path.join(fixtures, 'a'));
      const diffBefore = +s.mtime - before;
      if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
      if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
      sumDiffBefore += diffBefore;
      const diffAfter = +s.mtime - after;
      if (diffAfter < minDiffAfter) minDiffAfter = diffAfter;
      if (diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
      sumDiffAfter += diffAfter;
      if (i-- === 0) {
        afterMeassure();
      } else {
        testHelper.tick(100, checkMtime);
      }
    });

    function afterMeassure() {
      console.log(`mtime stats accuracy (before): [${minDiffBefore} ; ${maxDiffBefore}] avg ${Math.round(sumDiffBefore / count)}`);
      console.log(`mtime stats accuracy (after): [${minDiffAfter} ; ${maxDiffAfter}] avg ${Math.round(sumDiffAfter / count)}`);
      minDiffBefore.should.be.aboveOrEqual(-2000);
      maxDiffBefore.should.be.below(2000);
      minDiffAfter.should.be.aboveOrEqual(-2000);
      maxDiffAfter.should.be.below(2000);
      done();
    }
  });

  it('should have a file system with correct mtime behavior (chokidar)', function _test(done) {
    this.timeout(20000);
    testHelper.file('a');
    let i = 60;
    const count = 60;
    let before;
    let after;
    let minDiffBefore = +Infinity;
    let maxDiffBefore = -Infinity;
    let sumDiffBefore = 0;
    let minDiffAfter = +Infinity;
    let maxDiffAfter = -Infinity;
    let sumDiffAfter = 0;
    const watcher = chokidar.watch(fixtures, {
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false,
      depth: 0,
      atomic: false,
      alwaysStat: true,
      ignorePermissionErrors: true
    });

    watcherToClose = watcher;

    testHelper.tick(100, () => {
      watcher.on('change', (path, s) => {
        if (before && after) {
          const diffBefore = +s.mtime - before;
          if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
          if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
          sumDiffBefore += diffBefore;
          const diffAfter = +s.mtime - after;
          if (diffAfter < minDiffAfter) minDiffAfter = diffAfter;
          if (diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
          sumDiffAfter += diffAfter;
          before = undefined;
          after = undefined;
          if (i-- === 0) {
            afterMeassure();
          } else {
            testHelper.tick(100, checkMtime);
          }
        }
      });
      testHelper.tick(100, checkMtime);
    });

    function checkMtime() {
      before = Date.now();
      testHelper.file('a');
      after = Date.now();
    }

    function afterMeassure() {
      console.log(`mtime chokidar accuracy (before): [${minDiffBefore} ; ${maxDiffBefore}] avg ${Math.round(sumDiffBefore / count)}`);
      console.log(`mtime chokidar accuracy (after): [${minDiffAfter} ; ${maxDiffAfter}] avg ${Math.round(sumDiffAfter / count)}`);
      minDiffBefore.should.be.aboveOrEqual(-2000);
      maxDiffBefore.should.be.below(2000);
      minDiffAfter.should.be.aboveOrEqual(-2000);
      maxDiffAfter.should.be.below(2000);
      done();
    }
  });

  it('should not fire events in subdirectories', (done) => {
    testHelper.dir('watch-test-directory');
    const watcher = chokidar.watch(fixtures, {
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false,
      depth: 0,
      atomic: false,
      alwaysStat: true,
      ignorePermissionErrors: true
    });
    watcherToClose = watcher;
    watcher.on('add', (arg) => {
      done(new Error(`should not be emitted ${arg}`));
      done = function noop() {};
    });
    watcher.on('change', (arg) => {
      done(new Error(`should not be emitted ${arg}`));
      done = function noop() {};
    });
    watcher.on('error', (err) => {
      done(err);
      done = function noop() {};
    });
    testHelper.tick(500, () => {
      testHelper.file('watch-test-directory/watch-test-file');
      testHelper.tick(500, () => {
        done();
      });
    });
  });

  [100, 200, 300, 500, 700, 1000].reverse().forEach((delay) => {
    it(`should fire events not after start and ${delay}ms delay`, (done) => {
      testHelper.file(`watch-test-file-${delay}`);
      testHelper.tick(delay, () => {
        const watcher = chokidar.watch(fixtures, {
          ignoreInitial: true,
          persistent: true,
          followSymlinks: false,
          depth: 0,
          atomic: false,
          alwaysStat: true,
          ignorePermissionErrors: true
        });
        watcherToClose = watcher;
        watcher.on('add', (arg) => {
          done(new Error(`should not be emitted ${arg}`));
          done = function noop() {};
        });
        watcher.on('change', (arg) => {
          done(new Error(`should not be emitted ${arg}`));
          done = function noop() {};
        });
        watcher.on('error', (err) => {
          done(err);
          done = function noop() {};
        });
        testHelper.tick(500, () => {
          done();
        });
      });
    });
  });
});
