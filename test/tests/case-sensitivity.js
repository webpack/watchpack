'use strict';

/* globals describe it beforeEach afterEach */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Watchpack = require('../../lib/Watchpack');
const TestHelper = require('../helpers/TestHelper');

const casingTestPath = path.join(__dirname, '../../', 'PACKAGE.JSON');
const fixturePath = path.join(__dirname, '../fixturePath');
const helper = new TestHelper(fixturePath);

if (!fs.existsSync(casingTestPath)) {
  return;
}

describe('Case Sentitivity', () => {
  beforeEach(helper.before);
  afterEach(helper.after);

  it('should watch a file with the wrong casing', (done) => {
    const watchpack = new Watchpack({
      aggregateTimeout: 1000
    });

    let changeEvents = 0;

    watchpack.on('change', (file) => {
      assert(file, path.join(fixturePath, 'a'));
      changeEvents += 1;
    });

    watchpack.on('aggregated', (changes) => {
      assert(changes, [path.join(fixturePath, 'a')]);
      assert(changeEvents, 1);
      watchpack.close();
      done();
    });

    watchpack.watch([path.join(fixturePath, 'a')], []);

    helper.tick(() => {
      helper.file('A');
    });
  });
}).timeout(10000);
