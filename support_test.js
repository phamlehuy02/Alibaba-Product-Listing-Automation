/**
 * Alibaba Token Exchange Test - For Support Screenshot
 * App Key: 502296
 * App Category: GGS - SelfUse
 * 
 * Run: node support_test.js <FRESH_AUTH_CODE>
 * Example: node support_test.js 3_502296_xxxxx
 */

const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const APP_KEY = '502296';
const APP_SECRET = 'vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V';
const REDIRECT_URI = 'https://example.com/callback';

const code = process.argv[2];
if (!code) {
    console.log('Usage: node support_test.js <AUTH_CODE>');
    console.log('Get a fresh code from:');
    console.log('https://openapi-auth.alibaba.com/oauth/authorize?response_type=code&client_id=502296&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
    process.exit(1);
}

function iopSign(apiName, params, secret) {
    const sorted = Object.keys(params).filter(k => k !== 'sign').sort();
    let str = apiName;
    for (const key of sorted) {
        if (params[key] !== undefined && params[key] !== '') {
            str += key + params[key];
        }
    }
    return crypto.createHmac('sha256', secret).update(str, 'utf8').digest('hex').toUpperCase();
}

function httpPost(url, body) {
    return new Promise((resolve) => {
        const data = typeof body === 'string' ? body : querystring.stringify(body);
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data),
            },
        };
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
        });
        req.on('error', (e) => resolve({ status: 0, body: e.message }));
        req.write(data);
        req.end();
    });
}

async function main() {
    const ts = Date.now().toString();
    console.log('='.repeat(60));
    console.log('ALIBABA TOKEN EXCHANGE TEST');
    console.log('='.repeat(60));
    console.log(`Time:         ${new Date().toISOString()}`);
    console.log(`App Key:      ${APP_KEY}`);
    console.log(`Auth Code:    ${code}`);
    console.log(`Redirect URI: ${REDIRECT_URI}`);
    console.log('='.repeat(60));

    // Test 1: IOP Signed Request to api.taobao.global
    console.log('\n[TEST 1] POST https://api.taobao.global/rest/auth/token/create');
    console.log('         (IOP signed, sign_method=sha256)');
    const params1 = {
        app_key: APP_KEY,
        code: code,
        sign_method: 'sha256',
        timestamp: ts,
    };
    params1.sign = iopSign('/auth/token/create', params1, APP_SECRET);
    const r1 = await httpPost('https://api.taobao.global/rest/auth/token/create', params1);
    console.log(`  Status: ${r1.status}`);
    console.log(`  Response: ${r1.body}`);

    // Test 2: Standard OAuth to oauth.alibaba.com
    console.log('\n[TEST 2] POST https://oauth.alibaba.com/token');
    console.log('         (Standard OAuth2, client_id/client_secret)');
    const params2 = {
        grant_type: 'authorization_code',
        code: code,
        client_id: APP_KEY,
        client_secret: APP_SECRET,
        redirect_uri: REDIRECT_URI,
    };
    const r2 = await httpPost('https://oauth.alibaba.com/token', params2);
    console.log(`  Status: ${r2.status}`);
    console.log(`  Response: ${r2.body}`);

    // Test 3: GGS Gateway
    console.log('\n[TEST 3] POST https://gw.api.alibaba.com/openapi/param2/1/auth.token.create/' + APP_KEY);
    console.log('         (GGS Gateway, OAuth params)');
    const r3 = await httpPost(
        `https://gw.api.alibaba.com/openapi/param2/1/auth.token.create/${APP_KEY}`,
        params2
    );
    console.log(`  Status: ${r3.status}`);
    console.log(`  Response: ${r3.body}`);

    // Test 4: IOP with hmac-sha256
    console.log('\n[TEST 4] POST https://api.taobao.global/rest/auth/token/create');
    console.log('         (IOP signed, sign_method=hmac-sha256)');
    const params4 = {
        app_key: APP_KEY,
        code: code,
        sign_method: 'hmac-sha256',
        timestamp: ts,
    };
    params4.sign = iopSign('/auth/token/create', params4, APP_SECRET);
    const r4 = await httpPost('https://api.taobao.global/rest/auth/token/create', params4);
    console.log(`  Status: ${r4.status}`);
    console.log(`  Response: ${r4.body}`);

    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));
}

main();
