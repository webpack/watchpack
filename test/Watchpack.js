'use strict';

/* globals describe it beforeEach afterEach */
/* eslint no-plusplus: off */
require('should');
const path = require('path');
const Watchpack = require('../lib/watchpack');
const TestHelper = require('./helpers/TestHelper');

const fixtures = path.join(__dirname, 'fixtures');
const testHelper = new TestHelper(fixtures);

describe('Watchpack', function desc() {
  this.timeout(10000);
  beforeEach(testHelper.before);
  afterEach(testHelper.after);

  it('should watch a single file', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    let changeEvents = 0;
    w.on('change', (file) => {
      file.should.be.eql(path.join(fixtures, 'a'));
      changeEvents++;
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'a')]);
      changeEvents.should.be.eql(1);
      w.close();
      done();
    });
    w.watch([path.join(fixtures, 'a')], []);
    testHelper.tick(() => {
      testHelper.file('a');
    });
  });

  it('should watch multiple files', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.sort().should.be.eql([path.join(fixtures, 'a'), path.join(fixtures, 'b')]);
      changeEvents.should.be.eql([
        path.join(fixtures, 'a'),
        path.join(fixtures, 'b'),
        path.join(fixtures, 'a'),
        path.join(fixtures, 'b'),
        path.join(fixtures, 'a')
      ]);
      Object.keys(w.getTimes()).sort().should.be.eql([
        path.join(fixtures, 'a'),
        path.join(fixtures, 'b')
      ]);
      w.close();
      done();
    });
    w.watch([path.join(fixtures, 'a'), path.join(fixtures, 'b')], []);
    testHelper.tick(400, () => {
      testHelper.file('a');
      testHelper.tick(400, () => {
        testHelper.file('b');
        testHelper.tick(400, () => {
          testHelper.file('a');
          testHelper.tick(400, () => {
            testHelper.file('b');
            testHelper.tick(400, () => {
              testHelper.file('a');
            });
          });
        });
      });
    });
  });

  it('should watch a directory', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'a')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.tick(200, () => {
      w.watch([], [path.join(fixtures, 'dir')]);
      testHelper.tick(200, () => {
        testHelper.file(path.join('dir', 'a'));
      });
    });
  });

  it('should watch a file then a directory', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'a')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.dir(path.join('dir', 'subdir'));
    testHelper.file(path.join('dir', 'a'));
    testHelper.tick(400, () => {
      w.watch([path.join(fixtures, 'dir', 'a')], []);
      testHelper.tick(() => {
        w.watch([path.join(fixtures, 'dir')], [path.join(fixtures, 'dir')]);
        testHelper.tick(() => {
          testHelper.file(path.join('dir', 'a'));
        });
      });
    });
  });

  it('should watch a directory (delete file)', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'a')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.file(path.join('dir', 'a'));
    testHelper.tick(() => {
      w.watch([], [path.join(fixtures, 'dir')]);
      testHelper.tick(() => {
        testHelper.remove(path.join('dir', 'a'));
      });
    });
  });

  it('should watch a directory (delete and recreate file)', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([
        path.join(fixtures, 'dir', 'a'),
        path.join(fixtures, 'dir', 'b'),
        path.join(fixtures, 'dir', 'a')
      ]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.file(path.join('dir', 'a'));
    testHelper.tick(() => {
      w.watch([], [path.join(fixtures, 'dir')]);
      testHelper.tick(() => {
        testHelper.remove(path.join('dir', 'a'));
        testHelper.tick(() => {
          testHelper.file(path.join('dir', 'b'));
          testHelper.tick(() => {
            testHelper.file(path.join('dir', 'a'));
          });
        });
      });
    });
  });

  it('should watch a missing directory', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir', 'sub')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'sub')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.tick(() => {
      w.watch([], [path.join(fixtures, 'dir', 'sub')]);
      testHelper.tick(() => {
        testHelper.dir(path.join('dir', 'sub'));
      });
    });
  });

  it('should watch a directory (add directory)', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'sub')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.tick(() => {
      w.watch([], [path.join(fixtures, 'dir')]);
      testHelper.tick(() => {
        testHelper.dir(path.join('dir', 'sub'));
      });
    });
  });

  it('should watch a directory (delete directory)', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.dir(path.join('dir', 'sub'));
    testHelper.file(path.join('dir', 'sub', 'a'));
    testHelper.tick(() => {
      w.watch([], [path.join(fixtures, 'dir')]);
      testHelper.tick(() => {
        testHelper.remove(path.join('dir', 'sub'));
      });
    });
  });

  it('should watch a directory (delete directory2)', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'sub')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.dir(path.join('dir', 'sub'));
    testHelper.tick(() => {
      w.watch([], [path.join(fixtures, 'dir')]);
      testHelper.tick(() => {
        testHelper.remove(path.join('dir', 'sub'));
      });
    });
  });

  it('should watch already watched directory', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'a')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.file(path.join('dir', 'a'));
    testHelper.tick(400, () => {
      w.watch([path.join(fixtures, 'dir', 'a')], []);
      testHelper.tick(1000, () => {
        w.watch([], [path.join(fixtures, 'dir')]);
        testHelper.tick(400, () => {
          testHelper.remove(path.join('dir', 'a'));
        });
      });
    });
  });

  it('should watch file in a sub directory', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'sub', 'a')]);
      const times = w.getTimes();
      times[path.join(fixtures, 'dir')].should.be.type('number');
      times[path.join(fixtures, 'dir')].should.be.eql(times[path.join(fixtures, 'dir', 'sub', 'a')]);
      times[path.join(fixtures, 'dir', 'sub')].should.be.eql(times[path.join(fixtures, 'dir', 'sub', 'a')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.dir(path.join('dir', 'sub'));
    testHelper.tick(() => {
      w.watch([], [path.join(fixtures, 'dir')]);
      testHelper.tick(() => {
        testHelper.file(path.join('dir', 'sub', 'a'));
      });
    });
  });

  it('should watch file in a sub sub directory', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'sub', 'sub', 'a')]);
      Object.keys(w.getTimes()).sort().should.be.eql([
        path.join(fixtures, 'dir'),
        path.join(fixtures, 'dir', 'sub'),
        path.join(fixtures, 'dir', 'sub', 'sub'),
        path.join(fixtures, 'dir', 'sub', 'sub', 'a')
      ]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.dir(path.join('dir', 'sub'));
    testHelper.dir(path.join('dir', 'sub', 'sub'));
    testHelper.tick(() => {
      w.watch([], [path.join(fixtures, 'dir')]);
      testHelper.tick(() => {
        testHelper.file(path.join('dir', 'sub', 'sub', 'a'));
      });
    });
  });

  it('should watch file in a directory that contains special glob characters', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const changeEvents = [];
    w.on('change', (file) => {
      if (changeEvents[changeEvents.length - 1] === file) { return; }
      changeEvents.push(file);
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'dir')]);
      changeEvents.should.be.eql([path.join(fixtures, 'dir', 'sub()', 'a')]);
      const times = w.getTimes();
      times[path.join(fixtures, 'dir')].should.be.type('number');
      times[path.join(fixtures, 'dir')].should.be.eql(times[path.join(fixtures, 'dir', 'sub()', 'a')]);
      times[path.join(fixtures, 'dir', 'sub()')].should.be.eql(times[path.join(fixtures, 'dir', 'sub()', 'a')]);
      w.close();
      done();
    });
    testHelper.dir('dir');
    testHelper.dir(path.join('dir', 'sub()'));
    testHelper.tick(() => {
      w.watch([], [path.join(fixtures, 'dir')]);
      testHelper.tick(() => {
        testHelper.file(path.join('dir', 'sub()', 'a'));
      });
    });
  });

  it('should detect a single change to future timestamps', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const w2 = new Watchpack({
      aggregateTimeout: 1000
    });
    w.on('change', () => {
      throw new Error('should not report change event');
    });
    w.on('aggregated', () => {
      throw new Error('should not report aggregated event');
    });
    testHelper.file('a');
    testHelper.tick(400, () => {
      w2.watch([path.join(fixtures, 'a')], []);
      // wait for initial scan
      testHelper.tick(1000, () => {
        testHelper.mtime('a', Date.now() + 1000000);
        testHelper.tick(400, () => {
          w.watch([path.join(fixtures, 'a')], []);
          testHelper.tick(1000, () => {
            w2.close();
            w.close();
            done();
          });
        });
      });
    });
  });

  it('should detect a past change to a file (timestamp)', (done) => {
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    let changeEvents = 0;
    w.on('change', (file) => {
      file.should.be.eql(path.join(fixtures, 'a'));
      changeEvents++;
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'a')]);
      changeEvents.should.be.greaterThan(0);
      w.close();
      done();
    });
    const startTime = Date.now();
    testHelper.tick(() => {
      testHelper.file('a');
      testHelper.tick(() => {
        w.watch([path.join(fixtures, 'a')], [], startTime);
      });
    });
  });

  it('should not detect a past change to a file (watched)', (done) => {
    const w2 = new Watchpack();
    const w = new Watchpack();
    w.on('change', () => {
      throw new Error('Should not be detected');
    });
    testHelper.tick(() => {
      testHelper.file('b');
      w2.watch([path.join(fixtures, 'b')], []);
      // wait for stable state
      testHelper.tick(1000, () => {
        testHelper.file('a');
        testHelper.tick(() => {
          const startTime = Date.now();
          testHelper.tick(400, () => {
            w.watch([path.join(fixtures, 'a')], [], startTime);
            testHelper.tick(1000, () => {
              w.close();
              w2.close();
              done();
            });
          });
        });
      });
    });
  });

  it('should detect a past change to a file (watched)', (done) => {
    const w2 = new Watchpack();
    const w = new Watchpack();
    let changeEvents = 0;
    w.on('change', (file) => {
      file.should.be.eql(path.join(fixtures, 'a'));
      changeEvents++;
    });
    w.on('aggregated', (changes) => {
      changes.should.be.eql([path.join(fixtures, 'a')]);
      changeEvents.should.be.eql(1);
      w.close();
      w2.close();
      done();
    });
    testHelper.tick(() => {
      testHelper.file('b');
      w2.watch([path.join(fixtures, 'b')], []);
      testHelper.tick(() => {
        const startTime = Date.now();
        testHelper.tick(() => {
          testHelper.file('a');
          testHelper.tick(400, () => {
            w.watch([path.join(fixtures, 'a')], [], startTime);
          });
        });
      });
    });
  });

  it('should watch a single file removal', (done) => {
    testHelper.file('a');
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    let removeEvents = 0;
    w.on('remove', (file) => {
      file.should.be.eql(path.join(fixtures, 'a'));
      removeEvents++;
    });
    w.on('aggregated', (changes, removals) => {
      removals.should.be.eql([path.join(fixtures, 'a')]);
      removeEvents.should.be.eql(1);
      w.close();
      done();
    });
    testHelper.tick(400, () => {
      w.watch([path.join(fixtures, 'a')], []);
      testHelper.tick(() => {
        testHelper.remove('a');
      });
    });
  });

  it('should watch multiple file removals', (done) => {
    testHelper.file('a');
    testHelper.file('b');
    const w = new Watchpack({
      aggregateTimeout: 1000
    });
    const removeEvents = [];
    w.on('remove', (file) => {
      if (removeEvents[removeEvents.length - 1] === file) { return; }
      removeEvents.push(file);
    });
    w.on('aggregated', (changes, removals) => {
      removals.sort().should.be.eql([path.join(fixtures, 'a'), path.join(fixtures, 'b')]);
      removeEvents.should.be.eql([
        path.join(fixtures, 'a'),
        path.join(fixtures, 'b'),
        path.join(fixtures, 'a'),
        path.join(fixtures, 'b')
      ]);
      Object.keys(w.getTimes()).sort().should.be.eql([
        path.join(fixtures, 'a'),
        path.join(fixtures, 'b')
      ]);
      w.close();
      done();
    });
    testHelper.tick(400, () => {
      w.watch([path.join(fixtures, 'a'), path.join(fixtures, 'b')], []);
      testHelper.tick(() => {
        testHelper.remove('a');
        testHelper.tick(() => {
          testHelper.remove('b');
          testHelper.tick(() => {
            testHelper.file('a');
            testHelper.file('b');
            testHelper.tick(() => {
              testHelper.remove('a');
              testHelper.tick(() => {
                testHelper.remove('b');
              });
            });
          });
        });
      });
    });
  });
});
