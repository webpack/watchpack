'use strict';

/* globals describe it beforeEach afterEach */
require('should');
const fs = require('fs');
const path = require('path');
const Watchpack = require('../lib/watchpack');
const TestHelper = require('./helpers/TestHelper');

const fixtures = path.join(__dirname, 'fixtures');
const testHelper = new TestHelper(fixtures);

let fsIsCaseInsensitive;
try {
  fsIsCaseInsensitive = fs.existsSync(path.join(__dirname, '..', 'PACKAGE.JSON'));
} catch (e) {
  fsIsCaseInsensitive = false;
}

if (fsIsCaseInsensitive) {
  describe('Casing', function d() {
    this.timeout(10000);
    beforeEach(testHelper.before);
    afterEach(testHelper.after);

    it('should watch a file with the wrong casing', (done) => {
      const w = new Watchpack({
        aggregateTimeout: 1000
      });
      let changeEvents = 0;
      w.on('change', (file) => {
        file.should.be.eql(path.join(fixtures, 'a'));
        changeEvents += 1;
      });
      w.on('aggregated', (changes) => {
        changes.should.be.eql([path.join(fixtures, 'a')]);
        changeEvents.should.be.eql(1);
        w.close();
        done();
      });
      w.watch([path.join(fixtures, 'a')], []);
      testHelper.tick(() => {
        testHelper.file('A');
      });
    });
  });
}
