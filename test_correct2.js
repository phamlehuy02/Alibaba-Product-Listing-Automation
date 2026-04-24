const appKey = '502296';
const appSecret = 'vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V';
const code = '3_502296_q7itY8enfeR0F2MXftjzzk1F279';
const redirectUri = 'https://example.com/callback';

async function testCorrectEndpointAppKey() {
    console.log("=== Testing https://api.alibaba.com/rest/auth/token/create with app_key ===");
    try {
        const url = 'https://api.alibaba.com/rest/auth/token/create';
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            app_key: appKey,
            app_secret: appSecret,
            redirect_uri: redirectUri
        });

        const res = await fetch(url, {
            method: 'POST',
            body: params,
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${await res.text()}`);
    } catch(e) { console.log(e.message); }
}

testCorrectEndpointAppKey();
