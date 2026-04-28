const crypto = require('crypto');
const fetch = require('node-fetch');

const appKey = '502296';
const appSecret = 'vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V';
const code = '3_502296_OfWcBP8M10TJXDF8SvbepCjS44';

function sign(apiName, params, secret) {
    const sortedKeys = Object.keys(params).sort();
    let str = apiName;
    for (const key of sortedKeys) {
        if (key !== 'sign' && params[key] !== undefined && params[key] !== '') {
            str += key + params[key];
        }
    }
    
    return crypto.createHmac('sha256', secret)
        .update(str)
        .digest('hex')
        .toUpperCase();
}

async function performExchange() {
    const apiName = '/auth/token/create';
    const params = {
        app_key: appKey,
        code: code,
        grant_type: 'authorization_code',
        timestamp: Date.now().toString(),
        sign_method: 'hmac-sha256'
    };
    
    params.sign = sign(apiName, params, appSecret);
    
    const body = new URLSearchParams(params).toString();
    const url = 'https://api.taobao.global/rest' + apiName;
    
    console.log('Requesting URL:', url);
    console.log('Body:', body);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });
        
        const data = await response.json();
        console.log('RESULT:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('ERROR:', error);
    }
}

performExchange();
