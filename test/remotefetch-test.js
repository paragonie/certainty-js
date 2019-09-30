const assert = require('assert');
const fsp = require('fs').promises;
const expect = require('chai').expect;
const path = require('path');

const {Bundle, RemoteFetch} = require('../index');

const rootDir = __dirname + '/../';

describe('RemoteFetch', function () {
    this.timeout(0);
    it('Fetches a bundle', async () => {
        try {
            let root = await fsp.realpath(path.join(rootDir, 'data'));
            let rf = await RemoteFetch.create(root);
            let latest = await rf.getLatestBundle();
            expect(latest instanceof Bundle).to.be.equal(true);
            let contents = await latest.getFileContents();
            expect(contents.length).to.be.above(100);
        } catch (e) {
            assert(false);
        }
    });
});
