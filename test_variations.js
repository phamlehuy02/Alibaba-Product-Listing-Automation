const appKey = '502296';
const appSecret = 'vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V';
const code = '3_502296_q7itY8enfeR0F2MXftjzzk1F279';
const redirectUri = 'https://example.com/callback';

async function testVariations() {
    console.log("=== Testing 405 Endpoint with GET ===");
    try {
        const getUrl = `https://openapi-auth.alibaba.com/oauth/token?grant_type=authorization_code&code=${code}&client_id=${appKey}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        const resGet = await fetch(getUrl, { method: 'GET' });
        console.log(`GET Status: ${resGet.status}`);
        console.log(`Body: ${await resGet.text()}`);
    } catch(e) { console.log(e.message); }

    console.log("\n=== Testing REST Endpoint with app_key ===");
    try {
        const url = 'https://api.alibaba.com/rest/system.oauth2/getToken';
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('app_key', appKey);      // <--- CHANGED THIS
        params.append('app_secret', appSecret); // <--- CHANGED THIS
        params.append('redirect_uri', redirectUri);

        const resRest = await fetch(url, {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        console.log(`REST Status: ${resRest.status}`);
        console.log(`Body: ${await resRest.text()}`);
    } catch(e) { console.log(e.message); }
    
    console.log("\n=== Testing gw.api.alibaba.com with correct app_key ===");
    try {
        const gwUrl = `https://gw.api.alibaba.com/openapi/http/1/system.oauth2/getToken/${appKey}`;
        const params2 = new URLSearchParams();
        params2.append('grant_type', 'authorization_code');
        params2.append('code', code);
        params2.append('client_id', appKey);
        params2.append('client_secret', appSecret);
        params2.append('redirect_uri', redirectUri);

        const resGw = await fetch(gwUrl, {
            method: 'POST',
            body: params2,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        console.log(`GW Status: ${resGw.status}`);
        console.log(`Body: ${await resGw.text()}`);
    } catch(e) { console.log(e.message); }
}

testVariations();
