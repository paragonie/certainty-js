const assert = require('assert');
const expect = require('chai').expect;
const path = require('path');

const {Certainty} = require('../index');

const rootDir = __dirname + '/../';

describe('Certainty', function () {
    this.timeout(0);
    it('getHttp() returns a requests object', async () => {
        let returned = await Certainty.getHttp();
        expect(typeof returned['get']).to.be.equals('function');
        expect(typeof returned['head']).to.be.equals('function');
        expect(typeof returned['post']).to.be.equals('function');
        expect(typeof returned['put']).to.be.equals('function');
        expect(typeof returned['patch']).to.be.equals('function');
        expect(typeof returned['del']).to.be.equals('function');
        expect(typeof returned['delete']).to.be.equals('function');
        expect(typeof returned['cookie']).to.be.equals('function');
        expect(typeof returned['jar']).to.be.equals('function');
        expect(typeof returned['defaults']).to.be.equals('function');
    });

    it('getLatestCABundle() returns a buffer', async () => {
        let returned = await Certainty.getLatestCABundle();
        expect(Buffer.isBuffer(returned)).to.be.equals(true);
    });
});
