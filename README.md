# Certainty (JavaScript)

[![Travis CI](https://travis-ci.org/paragonie/certainty-js.svg?branch=master)](https://travis-ci.org/paragonie/certainty-js)
[![npm version](https://img.shields.io/npm/v/certainty-js.svg)](https://npm.im/certainty-js)

Node.js port of [Certainty](https://github.com/paragonie/certainty), a PHP library
designed to keep your CACert bundles up-to-date.

## Installation

```terminal
npm install --save certainty-js
```

**Optional:**

Certainty uses [Sodium-Plus](https://github.com/paragonie/sodium-plus) internally.
The default Sodium-Plus backend is cross-platform, but you can obtain greater
performance by installing `sodium-native` too.

```terminal
npm install --save sodium-native
```

This isn't strictly necessary, and sodium-native doesn't work in browsers, but
if you're not targeting browsers, you can get a significant performance boost.

## Usage

Certainty is intended to be used with `request-promise-native`.

### Easy Mode

Simply call `Certainty.getLatestCABundle()` and pass the `Buffer`
it returns to the `ca` key of your request options object:

```javascript
const {Certainty} = require('certainty-js');

(async function () {
    // Your normal options
    let options = {
        'ca': await Certainty.getLatestCABundle('/path/to/directory'),

        // Other request options...
        'uri': 'https://php-chronicle.pie-hosted.com/chronicle/lasthash',
        'minVersion': 'TLSv1.2',
        'strictSSL': true,
        'timeout': 30000
    };

    // Send request...
    console.log(await http.get(options));
})();
```

This should produce something similar to:

```
{
    "version": "1.2.x",
    "datetime": "2019-09-30T19:29:45-04:00",
    "status": "OK",
    "results": [
        {
            "contents": "{\n    \"repository\": \"paragonie\\\/certainty\",\n    \"sha256\": \"38b6230aa4bee062cd34ee0ff6da173250899642b1937fc130896290b6bd91e3\",\n    \"signature\": \"4bd4fae2644726f4f9298b5d9399430c18db88d8f72ea6cdc89429dd43daf5032fb632912697643549938277a7b5235c3353da1b79ff14da3333aef16acfdd03\",\n    \"time\": \"2019-08-29T22:12:29-04:00\"\n}",
            "prevhash": "8wL2OsihjC2ihOfyjqs2YwvZbry11veuWucqjhz4f6Y=",
            "currhash": "POcMRaSfk6myzsMmU-34OYXQzdsS6nqigRPLWohsfeI=",
            "summaryhash": "PW9pdgWmCjmswCmDLzJY51ENVdBRcZcJiUwKHBfQc2k=",
            "created": "2019-08-29T22:12:31-04:00",
            "publickey": "mPLfrUEV_qnwlsNUhbO_ILBulKysO3rPYYWqWAYCA0I=",
            "signature": "CRwq2nWby3v68EKXoM5QA11D5bZKWCJwM1rmvUpM2BfcKHc0zxr9z1CAsHDLP3NffCYT6jCKmTj6H07VgaFJCw=="
        }
    ]
}
```

### Advanced Mode

You can use the `RemoteFetch` and `Fetch` APIs directly to manage your
certificates asynchronously.

#### RemoteFetch

The `RemoteFetch` class will, once per day, check for new CACert bundles.
If any are found, it will automatically check their SHA256 hashes (provided
by the cURL developer), Ed25519 signatures (signed by Paragon Initiative
Enterprises), and verify they are committed to a Chronicle instance.

(Chronicle is a cryptographic ledger. We use it to ensure 
[everyone sees the same thing](https://defuse.ca/triangle-of-secure-code-delivery.htm).) 

```javascript
const {RemoteFetch} = require('certainty-js');
(async function () {
    let fetcher = new RemoteFetch('/path/to/directory');
    let bundle = fetcher.getLatestBundle();
    console.log(bundle.getFilePath());
})();
```

#### Fetch

The `Fetch` class only looks at the local filesystem. It does not look for
fresh CACert bundles to download.

```javascript
const {Fetch} = require('certainty-js');
(async function () {
    let fetcher = new Fetch('/path/to/directory');
    let bundle = fetcher.getLatestBundle();
    console.log(bundle.getFilePath());
})();
```
