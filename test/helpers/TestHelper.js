'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const del = require('del');
const manager = require('../../lib/manager');

function tick(timeout, fn) {
  if (typeof timeout === 'function') {
    fn = timeout;
    timeout = 100;
  }
  setTimeout(() => {
    fn();
  }, timeout);
}

module.exports = class TestHelper {
  constructor(targetPath) {
    this.targetPath = targetPath;

    this.before = this.beforeHook.bind(this);
    this.after = this.afterHook.bind(this);
    this.tick = tick;
  }

  beforeHook(done) {
    assert(Object.keys(manager.watchers), []);

    tick(400, () => {
      if (fs.existsSync(this.targetPath)) {
        del.sync(this.targetPath);
      }

      fs.mkdirSync(this.targetPath);
      done();
    });
  }

  afterHook(done) {
    let i = 0;
    const remove = () => {
      try {
        del.sync(this.targetPath);
      } catch (e) {
        if (i++ > 20) { // eslint-disable-line no-plusplus
          throw e;
        }

        tick(100, remove);
        return;
      }

      assert.deepEqual(Object.keys(manager.watchers), []);
      tick(300, done);
    };

    tick(300, remove);
  }

  dir(name) {
    fs.mkdirSync(path.join(this.targetPath, name));
  }

  file(name) {
    fs.writeFileSync(path.join(this.targetPath, name), `${Math.random()}`, 'utf-8');
  }

  mtime(name, time) {
    const stats = fs.statSync(path.join(this.targetPath, name));
    fs.utimesSync(path.join(this.targetPath, name), stats.atime, new Date(time));
  }

  remove(name) {
    del.sync(path.join(this.targetPath, name));
  }
};
