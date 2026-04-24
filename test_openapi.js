const appKey = '502296';
const appSecret = 'vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V';
const code = '3_502296_q7itY8enfeR0F2MXftjzzk1F279';
const redirectUri = 'https://example.com/callback';

async function testOpenApi() {
    console.log("=== Testing https://openapi.alibaba.com/oauth/token ===");
    try {
        const url = 'https://openapi.alibaba.com/oauth/token';
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: appKey,
            client_secret: appSecret,
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

testOpenApi();
