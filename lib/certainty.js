const http = require('request-promise-native');

class Certainty {
    /*
    static CHRONICLE_CLIENT_ID = 'Chronicle-Client-Key-ID';
    static ED25519_HEADER = 'Body-Signature-Ed25519';
    */
    constructor() {
        this.validators = {};
        return this;
    }

    static getRepository() {
        return 'paragonie/certainty';
    }

    static getTrustDefault() {
        return 'Mozilla';
    }
    /**
     * Get the HTTP driver (request-promise)
     *
     * @param {RemoteFetch|null} rf
     * @param {Number|null} timeout
     * @return {Promise<http>}
     */
    static async getHttp(rf = null, timeout = 5) {
        let options = {
            'minVersion': 'TLSv1.2',
            'strictSSL': true,
            'timeout': timeout * 1000
        };
        if (!rf) {
            let RemoteFetch = require('./remotefetch');
            rf = await RemoteFetch.create();
        }
        let latest = await rf.getLatestBundle();
        if (latest) {
            options['ca'] = await latest.getFileContents();
        }
        return http.defaults(options);
    }

    /**
     * @param {string} dataDir
     * @return {Promise<Buffer>}
     */
    static async getLatestCABundle(dataDir = '') {
        let RemoteFetch = require('./remotefetch');
        let rf = await RemoteFetch.create(dataDir);
        let latest = await rf.getLatestBundle();
        return await latest.getFileContents();
    }

    /**
     * Get the HTTP driver (request-promise)
     *
     * @param {Fetch|null} fetch
     * @param {Number|null} timeout
     * @return {Promise<http>}
     */
    static async getHttpInternal(fetch = null, timeout = 5) {
        let options = {
            'minVersion': 'TLSv1.2',
            'strictSSL': true,
            'timeout': timeout * 1000
        };
        if (fetch) {
            try {
                let latest = await fetch.getLatestBundle();
                if (latest) {
                    options['ca'] = await latest.getFileContents();
                }
            } catch (e) {
            }
        }
        return http.defaults(options);
    }
}
module.exports = Certainty;
