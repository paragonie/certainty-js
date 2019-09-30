const beautify = require('json-beautify');
const fsp = require('fs').promises;
const moment = require('moment');
const path = require('path');

const Certainty = require('./certainty');
const Fetch = require('./fetch');
const Validator = require('./validator');

const DEFAULT_URL = 'https://raw.githubusercontent.com/paragonie/certainty/master/data/';

module.exports = class RemoteFetch extends Fetch {
    constructor(
        dataDir = '',
        url = '',
        timeout = 86400,
        chronicleUrl = '',
        chroniclePublicKey = '',
        connectTimeout = 5
    ) {
        super(dataDir);
        this.ready = false;
        this.remoteInit(
            dataDir,
            url,
            timeout,
            chronicleUrl,
            chroniclePublicKey,
            connectTimeout
        ).then(() => {
            // NOP
        }).catch((err) => {
            throw err;
        });
    }

    /**
     * @param {string} dataDir
     * @param {string} url
     * @param {string|number|null} timeout
     * @param {string} chronicleUrl
     * @param {string} chroniclePublicKey
     * @param {number} connectTimeout
     * @return {Promise<RemoteFetch>}
     */
    static async create(
        dataDir = '',
        url = '',
        timeout = 86400,
        chronicleUrl = '',
        chroniclePublicKey = '',
        connectTimeout = 5
    ) {
        return await (new RemoteFetch()).remoteInit(
            dataDir,
            url,
            timeout,
            chronicleUrl,
            chroniclePublicKey,
            connectTimeout
        );
    }

    /**
     *
     * @param {string} dataDir
     * @param {string} url
     * @param {string|number|null} timeout
     * @param {string} chronicleUrl
     * @param {string} chroniclePublicKey
     * @param {number} connectTimeout
     * @return {Promise<RemoteFetch>}
     */
    async remoteInit(
        dataDir = '',
        url = '',
        timeout = 86400,
        chronicleUrl = '',
        chroniclePublicKey = '',
        connectTimeout = 5
    ) {
        if (typeof dataDir === 'undefined') {
            dataDir = await fsp.realpath(__dirname + "/../data/");
        } else if (dataDir.length === 0) {
            dataDir = await fsp.realpath(__dirname + "/../data/");
        }
        this.dataDirectory = dataDir;
        this.CHECK_SIGNATURE_BY_DEFAULT = true;
        this.CHECK_CHRONICLE_BY_DEFAULT = true;
        this.connectTimeout = connectTimeout;
        this.http = await Certainty.getHttpInternal(null, this.connectTimeout);

        if (url.length < 1) {
            url = DEFAULT_URL;
        }
        this.url = url;
        if (timeout === null) {
            timeout = 86400;
        } else {
            timeout = parseInt(timeout, 10);
        }
        this.cacheTimeout = timeout;
        if (chronicleUrl && chroniclePublicKey) {
            this.setChronicle(chronicleUrl, chroniclePublicKey);
        }
        this.trustChannel = 'Mozilla';
        this.unverified = [];
        this.validators = {'': new Validator()};
        this.ready = true;
        return this;
    }

    /**
     * @return {Promise<boolean>}
     */
    async cacheExpired() {
        let cacheFile = path.join(this.dataDirectory, "ca-certs.cache");
        try {
            if (!await fsp.stat(cacheFile)) {
                return true;
            }
        } catch (e) {
            return true;
        }
        let cached = (await fsp.readFile(cacheFile)).toString('UTF-8');
        let cacheTime = moment(cached);
        let diff = moment().diff(cacheTime) / 1000;
        return (diff >= this.cacheTimeout);
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
        if (await this.cacheExpired()) {
            if (!await this.remoteFetchBundles()) {
                throw new Error('Could not download bundles');
            }
        }
        return await super.listBundles(customValidator, trustChannel);
    }

    /**
     * @return {Promise<boolean>}
     */
    async remoteFetchBundles() {
        if (!this.ready) {
            throw new Error("remoteInit() was never invoked");
        }
        let body = await this.http.get({
            'uri': this.url + "ca-certs.json"
        });
        let jsonDecoded = JSON.parse(body);

        if (await fsp.stat(this.dataDirectory + "/ca-certs.json")) {
            await fsp.rename(
                this.dataDirectory + "/ca-certs.json",
                this.dataDirectory + "/ca-certs-backup-" + (moment().format('YYYYMMDDHHmmss')) + ".json"
            );
        }
        await fsp.writeFile(
            this.dataDirectory + "/ca-certs.json",
            beautify(JSON.parse(body), null, 4)
        );

        let stat;
        for (let item of jsonDecoded) {
            if (!item.file) {
                continue;
            }
            if (!item.file.match(/^cacert(\-[0-9]{4}\-[0-9]{2}\-[0-9]{2})?\.pem$/)) {
                continue;
            }
            let filename = path.join(this.dataDirectory, item.file);
            try {
                stat = await fsp.stat(filename);
            } catch (e) {
                stat = false;
            }
            if (!stat) {
                // console.log(`Downloading ${filename}`);
                await fsp.writeFile(
                    filename,
                    await this.http.get({
                        'uri': this.url + item.file
                    })
                );
            }
        }
        await fsp.writeFile(
            path.join(this.dataDirectory, "ca-certs.cache"),
            moment().format()
        );
        return true;
    }
};
