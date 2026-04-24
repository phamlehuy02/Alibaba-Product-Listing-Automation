const appKey = '502296';
const appSecret = 'vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V';
const code = '3_502296_q7itY8enfeR0F2MXftjzzk1F279';
const redirectUri = 'https://example.com/callback';

const endpoints = [
    'https://openapi-auth.alibaba.com/oauth/token',
    `https://api.alibaba.com/openapi/http/1/system.oauth2/getToken/${appKey}`,
    'https://gw.api.alibaba.com/openapi/http/1/system.oauth2/getToken/' + appKey,
    'https://api.alibaba.com/rest/system.oauth2/getToken',
    'https://api.alibaba.com/auth/token/create'
];

async function testEndpoints() {
    for (const url of endpoints) {
        console.log(`\n========================================`);
        console.log(`🔍 Testing URL: ${url}`);
        
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('client_id', appKey);
            params.append('client_secret', appSecret);
            params.append('redirect_uri', redirectUri);

            const response = await fetch(url, {
                method: 'POST',
                body: params,
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            });

            console.log(`Status: ${response.status} ${response.statusText}`);
            
            const text = await response.text();
            console.log(`Response Body: ${text.substring(0, 300)}...`);

            if (response.ok && text.includes('access_token')) {
                console.log('✅ WINNER FOUND!');
                break;
            }
        } catch (err) {
            console.log(`❌ Request Error: ${err.message}`);
        }
    }
}

testEndpoints();
