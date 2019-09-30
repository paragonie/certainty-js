const fsp = require('fs').promises;

class Bundle {
    constructor(
        filePath,
        sha256sum = '',
        signature = '',
        customValidator = null,
        chronicleHash = '',
        trustChannel = ''
    ) {
        this.filePath = filePath;
        this.sha256sum = sha256sum;
        this.signature = signature;
        this.customValidator = customValidator;
        this.chronicleHash = chronicleHash;
        if (trustChannel.length === 0) {
            this.trustChannel = 'Mozilla';
        } else {
            this.trustChannel = trustChannel;
        }
    }

    /**
     * @param {boolean} raw
     * @return {string|Buffer}
     */
    getSignature(raw = false) {
        if (raw) {
            return Buffer.from(this.signature, 'hex');
        }
        return this.signature;
    }

    /**
     * @return {string}
     */
    getChronicleHash() {
        return this.chronicleHash;
    }

    /**
     * @return {string}
     */
    getFilePath() {
        return this.filePath;
    }

    /**
     * @return {Promise<Buffer>}
     */
    async getFileContents() {
        return await fsp.readFile(this.filePath);
    }

    /**
     * @param {boolean} raw
     * @return {string|Buffer}
     */
    getSha256Sum(raw = false) {
        if (raw) {
            return Buffer.from(this.sha256sum, 'hex');
        }
        return this.sha256sum;
    }

    /**
     * @return {string}
     */
    getTrustChannel() {
        return this.trustChannel;
    }

    /**
     * @return {boolean}
     */
    hasCustom() {
        return typeof (this.customValidator) === 'object';
    }
}

module.exports = Bundle;
