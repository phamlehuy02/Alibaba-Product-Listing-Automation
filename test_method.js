const crypto = require('crypto');

const appKey = '502296';
const appSecret = 'vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V';
const code = '3_502296_q7itY8enfeR0F2MXftjzzk1F279';

function getSignature(params) {
    const sortedKeys = Object.keys(params).sort();
    let str = appSecret;
    for (const key of sortedKeys) {
        if (params[key]) {
            str += key + params[key];
        }
    }
    str += appSecret;
    return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

async function testMethod() {
    const method = '/auth/token/create';
    console.log(`\n=== Testing method: ${method} ===`);
    const params = {
        method: method,
        app_key: appKey,
        sign_method: 'md5',
        timestamp: new Date().toISOString().replace('T', ' ').split('.')[0],
        format: 'json',
        v: '2.0',
        code: code,
        grant_type: 'authorization_code'
    };

    params.sign = getSignature(params);

    const urlParams = new URLSearchParams(params);
    
    try {
        const res = await fetch('https://api.alibaba.com/router/rest', {
            method: 'POST',
            body: urlParams,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${await res.text()}`);
    } catch(e) {
        console.log(e.message);
    }
}

testMethod();
