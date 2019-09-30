const base64url = require('rfc4648').base64url;
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const {Sapient, SigningPublicKey} = require('sapient');
const _sodium = require('libsodium-wrappers');

const Bundle = require('./bundle');

const BUFFER_SIZE = 16384;

const PRIMARY_SIGNING_PUBKEY = '98f2dfad4115fea9f096c35485b3bf20b06e94acac3b7acf6185aa5806020342';
const BACKUP_SIGNING_PUBKEY = '1cb438a66110689f1192b511a88030f02049c40d196dc1844f9e752531fdd195';
const CHRONICLE_URL = 'https://php-chronicle.pie-hosted.com/chronicle';
const CHRONICLE_PUBKEY = 'Bgcc1QfkP0UNgMZuHzi0hC1hA1SoVAyUrskmSkzRw3E=';

module.exports = class Validator {
    /**
     *
     * @param {string} chronicleUrl
     * @param {string} chroniclePublicKey
     */
    constructor(chronicleUrl = '', chroniclePublicKey = '') {
        this.init(chronicleUrl, chroniclePublicKey).then(() => {
            // NOP
        }).catch((err) => {
            throw err;
        });
    }

    /**
     * @param {string} chronicleUrl
     * @param {string} chroniclePublicKey
     * @return {Promise<Validator>}
     */
    async init(chronicleUrl = '', chroniclePublicKey = '') {
        await _sodium.ready;
        this.sodium = _sodium;
        if (chronicleUrl.length < 1) {
            chronicleUrl = CHRONICLE_URL;
        }
        if (chroniclePublicKey.length < 1) {
            chroniclePublicKey = CHRONICLE_PUBKEY;
        }
        this.chronicleUrl = chronicleUrl;
        this.chroniclePublicKey = chroniclePublicKey;
        this.throwMoreExceptions = false;
        return this;
    }

    async checkChronicleHash(bundle) {
        const Fetch = require('./fetch');
        if (!this.chronicleUrl && this.chroniclePublicKey) {
            // Custom validator has opted to fail open here. Who are we to dissent?
            return true;
        }
        if (!bundle.getChronicleHash()) {
            // No chronicle hash? This check fails closed.
            return false;
        }

        let chronicleUrl = this.chronicleUrl + '/lookup/' + bundle.getChronicleHash();
        let publicKey = new SigningPublicKey(base64url.parse(this.chroniclePublicKey));
        const Certainty = require('./certainty');

        let dir = bundle.getFilePath().split('/');
        dir.pop();
        let http = await Certainty.getHttpInternal(
            new Fetch(dir.join('/'))
        );
        let untrusted = await http.get({uri: chronicleUrl, resolveWithFullResponse: true});
        let response = await Sapient.decodeSignedJsonResponse(untrusted, publicKey);
        let hashValid = false;
        for (let row of response.results) {
            hashValid = hashValid || await this.validateChronicleContents(bundle, row);
        }
        return hashValid;
    }

    /**
     * @param bundle
     * @param {boolean} backupKey
     * @return {Promise<boolean>}
     */
    async checkEd25519Signature(bundle, backupKey = false) {
        if (!(bundle instanceof Bundle)) {
            throw new TypeError('Argument 1 must be an instance of Bundle');
        }
        let publicKey;
        if (backupKey) {
            publicKey = Buffer.from(BACKUP_SIGNING_PUBKEY, 'hex');
        } else {
            publicKey = Buffer.from(PRIMARY_SIGNING_PUBKEY, 'hex');
        }
        return this.sodium.crypto_sign_verify_detached(
            bundle.getSignature(true),
            await fsp.readFile(bundle.getFilePath()),
            publicKey
        );
    }

    /**
     * @return {Promise<boolean>}
     */
    async checkSha256Sum(bundle) {
        if (!(bundle instanceof Bundle)) {
            throw new TypeError('Argument 1 must be an instance of Bundle');
        }
        /** @var {Buffer} sha256sum */
        let sha256sum = await this.hashFile(bundle.getFilePath(), 'sha256', true);
        return crypto.timingSafeEqual(
            sha256sum,
            await bundle.getSha256Sum(true)
        );
    }

    /**
     * Hash a file.
     *
     * @param {string} filename
     * @param {string} algo
     * @param {boolean} raw
     * @return {Promise<string|Buffer>}
     */
    async hashFile(filename, algo = 'sha256', raw = false) {
        let ctx = crypto.createHash(algo);
        let fh = await fsp.open(filename, 'r');
        let length = (await fh.stat()).size;
        let buf = Buffer.alloc(BUFFER_SIZE);
        let toRead = BUFFER_SIZE;
        for (let offset = 0; offset < length;) {
            toRead = Math.min(BUFFER_SIZE, length - offset);
            await fh.read(buf, 0, toRead, offset);
            ctx.update(buf.slice(0, toRead));
            offset += toRead;
        }
        await fh.close();
        if (raw) {
            return ctx.digest();
        }
        return ctx.digest('hex');
    }

    /**
     * @param {Bundle} bundle
     * @param {object} row
     * @return {Promise<boolean>}
     */
    async validateChronicleContents(bundle, row) {
        this.throwMoreExceptions = true;
        if (!row.signature || !row.contents || !row.publickey) {
            if (this.throwMoreExceptions) {
                throw new Error('Incomplete data');
            }
            return false;
        }

        let publicKey = base64url.parse(row.publickey);
        if (
            !crypto.timingSafeEqual(
                publicKey,
                Buffer.from(PRIMARY_SIGNING_PUBKEY, 'hex')
            ) && !crypto.timingSafeEqual(
                publicKey,
                Buffer.from(BACKUP_SIGNING_PUBKEY, 'hex')
            )
        ) {
            // This was not one of our keys.
            return false;
        }

        let signature = base64url.parse(row.signature);
        if (!this.sodium.crypto_sign_verify_detached(
            signature,
            row.contents,
            publicKey
        )) {
            if (this.throwMoreExceptions) {
                throw new Error('Invalid signature.');
            }
            return false;
        }

        if (!row.contents.includes(bundle.getSha256Sum())) {
            if (this.throwMoreExceptions) {
                throw new Error('SHA256 hash not present in response body');
            }
            return false;
        }

        const Certainty = require('./certainty');
        let repo = Certainty.getRepository();
        if (!row.contents.includes(repo) && !row.contents.includes(repo.replace('/', '\\/'))) {
            if (this.throwMoreExceptions) {
                throw new Error('Repository name not present in response body');
            }
            return false;
        }
        return true;
    }
};
