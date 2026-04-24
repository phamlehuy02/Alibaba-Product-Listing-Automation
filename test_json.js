const appKey = '502296';
const appSecret = 'vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V';
const code = '3_502296_q7itY8enfeR0F2MXftjzzk1F279';
const redirectUri = 'https://example.com/callback';

async function testJson() {
    console.log("=== Testing 405 Endpoint with application/json ===");
    try {
        const url = 'https://openapi-auth.alibaba.com/oauth/token';
        const body = {
            grant_type: 'authorization_code',
            code: code,
            client_id: appKey,
            client_secret: appSecret,
            redirect_uri: redirectUri
        };

        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${await res.text()}`);
    } catch(e) { console.log(e.message); }
}

testJson();
