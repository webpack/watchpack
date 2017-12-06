'use strict';

/* globals describe it beforeEach afterEach */
require('should');
const path = require('path');
const OrgDirectoryWatcher = require('../lib/DirectoryWatcher');
const TestHelper = require('./helpers/TestHelper');


const fixtures = path.join(__dirname, 'fixtures');
const testHelper = new TestHelper(fixtures);

const openWatchers = [];

const DirectoryWatcher = function dw(p, options) {
  const d = new OrgDirectoryWatcher(p, options);
  openWatchers.push(d);
  const orgClose = d.close;
  d.close = function close() {
    orgClose.call(this);
    const idx = openWatchers.indexOf(d);
    if (idx < 0) { throw new Error('DirectoryWatcher was already closed'); }
    openWatchers.splice(idx, 1);
  };
  return d;
};

describe('DirectoryWatcher', function desc() {
  this.timeout(10000);
  beforeEach(testHelper.before);
  afterEach(testHelper.after);
  afterEach(() => {
    openWatchers.forEach((d) => {
      console.log(`DirectoryWatcher (${d.path}) was not closed.`);
      d.close();
    });
  });

  it('should detect a file creation', (done) => {
    const d = new DirectoryWatcher(fixtures, {});
    const a = d.watch(path.join(fixtures, 'a'));
    a.on('change', (mtime) => {
      mtime.should.be.type('number');
      Object.keys(d.getTimes()).sort().should.be.eql([
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
    const d = new DirectoryWatcher(fixtures, {});
    testHelper.file('a');
    const a = d.watch(path.join(fixtures, 'a'));
    a.on('change', (mtime) => {
      mtime.should.be.type('number');
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
      const d = new DirectoryWatcher(fixtures, {});
      const a = d.watch(path.join(fixtures, 'a'));
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
        const d = new DirectoryWatcher(fixtures, {});
        const a = d.watch(path.join(fixtures, 'a'), start);
        a.on('change', () => {
          a.close();
          done();
        });
      });
    });
  });

  it('should not detect a file change in initial scan without start date', (done) => {
    testHelper.file('a');
    testHelper.tick(200, () => {
      const d = new DirectoryWatcher(fixtures, {});
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

  const timings = {
    slow: 300,
    fast: 50
  };
  Object.keys(timings).forEach((name) => {
    const time = timings[name];
    it(`should detect multiple file changes (${name})`, (done) => {
      const d = new DirectoryWatcher(fixtures, {});
      testHelper.file('a');
      testHelper.tick(() => {
        const a = d.watch(path.join(fixtures, 'a'));
        let count = 20;
        let wasChanged = false;
        a.on('change', (mtime) => {
          mtime.should.be.type('number');
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
    });
  });

  it('should detect a file removal', (done) => {
    testHelper.file('a');
    const d = new DirectoryWatcher(fixtures, {});
    const a = d.watch(path.join(fixtures, 'a'));
    a.on('remove', (mtime) => {
      (typeof mtime === 'undefined').should.be.true; // eslint-disable-line
      a.close();
      done();
    });
    testHelper.tick(() => {
      testHelper.remove('a');
    });
  });
});
