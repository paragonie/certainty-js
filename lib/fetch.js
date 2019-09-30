const beautify = require('json-beautify');
const fs = require('fs');
const fsp = fs.promises;
const moment = require('moment');
const path = require('path');
const Bundle = require('./bundle');
const Certainty = require('./certainty');
const Validator = require('./validator');

const FileSystemException = require('./exceptions/filesystemerror');

module.exports = class Fetch {
    constructor(dataDir = '') {
        this.init(dataDir).then(() => {
            // NOP
        }).catch((err) => {
            throw err;
        });
    }

    /**
     * @param {string} dataDir
     * @return {Promise<Fetch>}
     */
    static async create(
        dataDir = ''
    ) {
        return await (new Fetch()).init(dataDir);
    }

    /**
     * Asynchronous constructor
     *
     * @param {string} dataDir
     * @return {Promise<Fetch>}
     */
    async init(dataDir = '') {
        if (typeof dataDir === 'undefined') {
            dataDir = await fsp.realpath(__dirname + "/../data/");
        } else if (dataDir.length === 0) {
            dataDir = await fsp.realpath(__dirname + "/../data/");
        }
        if (!await fsp.stat(dataDir)) {
            throw new FileSystemException(`Could not open data directory (${dataDir}) for reading/writing`);
        }
        this.chroniclePublicKey = '';
        this.chronicleUrl = '';
        this.dataDirectory = dataDir;
        this.trustChannel = 'Mozilla';
        this.unverified = [];
        this.validators = {'': new Validator()};
        this.CHECK_SIGNATURE_BY_DEFAULT = false;
        this.CHECK_CHRONICLE_BY_DEFAULT = false;
        return this;
    }

    /**
     * @param {boolean|null} checkEd25519Signature
     * @param {boolean|null} checkChronicle
     * @return {Promise<Bundle>}
     */
    async getLatestBundle(checkEd25519Signature = null, checkChronicle = null) {
        if (checkEd25519Signature === null) {
            checkEd25519Signature = this.CHECK_SIGNATURE_BY_DEFAULT;
        }
        let conditionalChronicle = (typeof(checkChronicle) === 'undefined') || (checkChronicle === null);
        if (conditionalChronicle) {
            checkChronicle = this.CHECK_CHRONICLE_BY_DEFAULT;
        }
        if (typeof(checkEd25519Signature) === 'undefined') {
            checkEd25519Signature = true;
        }
        if (typeof(checkChronicle) === 'undefined') {
            checkChronicle = true;
        }

        let bundleIndex = 0;
        let allBundles = await this.listBundles('', this.trustChannel);
        let bundleKeys = Object.keys(allBundles).sort().reverse();
        let bun;
        let validator;
        let valid;
        let default_validator = new Validator(this.chronicleUrl, this.chroniclePublicKey);
        for (let bk of bundleKeys) {
            /** @var {Bundle} bun */
            bun = allBundles[bk];
            if (bun.hasCustom()) {
                if (typeof(this.validators[bun.customValidator]) === 'undefined') {
                    validator = default_validator;
                } else {
                    validator = this.validators[bun.customValidator];
                }
            } else {
                validator = default_validator;
            }
            if (!await validator.checkSha256Sum(bun)) {
                await this.markBundleAsBad(bundleIndex, 'SHA256 mismatch');
                continue;
            }
            valid = true;
            if (checkEd25519Signature) {
                valid = valid && await validator.checkEd25519Signature(bun);
                if (!valid) {
                    await this.markBundleAsBad(bundleIndex, 'Ed25519 signature mismatch');
                }
            }
            if (conditionalChronicle && checkChronicle) {
                // Conditional Chronicle check (only on first brush):
                let index = this.unverified.indexOf(bun.getFilePath());
                if (index >= 0) {
                    let validChronicle = await validator.checkChronicleHash(bun);
                    valid = valid && validChronicle;
                    if (validChronicle) {
                        delete this.unverified[index];
                    } else {
                        await this.markBundleAsBad(bundleIndex, 'Chronicle');
                    }
                }
            } else if (checkChronicle) {
                valid = valid && await validator.checkChronicleHash(bun);
            }
            if (valid) {
                return bun;
            }
            bundleIndex++;
        }
        throw new Error('No valid bundles were found in the data directory.');
    }

    /**
     * @param {string} customValidator
     * @return {Bundle[]}
     */
    async getAllBundles(customValidator = '') {
        return Object.values(await this.listBundles(customValidator));
    }

    /**
     * @return {Promise<Object|Array>}
     */
    async loadCaCertsFile() {
        let fullPath = path.join(this.dataDirectory, 'ca-certs.json');
        let access = false;
        try {
            access = await fsp.stat(fullPath);
        } catch (e) {
            throw new FileSystemException(`${fullPath} could not be loaded`);
        }
        return JSON.parse((await fsp.readFile(fullPath)).toString());
    }

    /**
     * @param {string} customValidator
     * @param {string} trustChannel
     * @return {Promise<object<string, Bundle>>}
     */
    async listBundles(customValidator = '', trustChannel = '') {
        if (trustChannel.length === 0) {
            trustChannel = Certainty.getTrustDefault();
        }
        let key = '';
        let data = await this.loadCaCertsFile();
        let bundles = [];
        for (let row of data) {
            if (typeof(row['date']) === 'undefined') continue;
            if (typeof(row['file']) === 'undefined') continue;
            if (typeof(row['sha256']) === 'undefined') continue;
            if (typeof(row['signature']) === 'undefined') continue;
            if (typeof(row['trust-channel']) === 'undefined') continue;
            try {
                if (!await fsp.stat(
                    path.join(this.dataDirectory, row['file'])
                )) {
                    continue;
                }
            } catch (e) {
                continue;
            }
            if (row['bad-bundle']) continue;
            if (row['trust-channel'] !== trustChannel) continue;

            key = row['date'].replace(/[^0-9]/, '') + '0000';
            while (typeof(bundles[key]) !== 'undefined') {
                key = (parseInt(key, 10) + 1).toString();
            }
            bundles[key] = new Bundle(
                path.join(this.dataDirectory, row['file']),
                row['sha256'],
                row['signature'],
                row['custom'] ? row['custom'] : customValidator,
                row['chronicle'] ? row['chronicle'] : '',
                trustChannel
            );
        }
        return bundles;
    }

    /**
     * @param {number} index
     * @param {string} reason
     * @return {Promise<void>}
     */
    async markBundleAsBad(index = 0, reason = '') {
        let data = await this.loadCaCertsFile();
        let now = moment().format();
        data[index]['bad-bundle'] = `Marked bad on ${now} for reason: ${reason}`;
        let toWrite = beautify(data, null, 4);
        await fsp.writeFile(
            path.join(this.dataDirectory, 'ca-certs.json'),
            toWrite
        );
    }

    /**
     * @param {string} url
     * @param {string} publicKey
     * @return {Fetch}
     */
    setChronicle(url, publicKey) {
        this.chronicleUrl = url;
        this.chroniclePublicKey = publicKey;
        return this;
    }

    /**
     * @param {string} name
     * @param {Validator} obj
     * @return {Fetch}
     */
    addValidator(name, obj) {
        this.validators[name] = obj;
        return this;
    }
};
