async function testUrls() {
    const urls = [
        'https://openapi-auth.alibaba.com/token',
        'https://openapi-auth.alibaba.com/oauth2/token',
        'https://openapi-auth.alibaba.com/oauth/token.do'
    ];

    for (const url of urls) {
        console.log(`\n=== Testing ${url} ===`);
        try {
            const res = await fetch(url, { method: 'POST' });
            console.log(`Status: ${res.status}`);
        } catch(e) {
            console.log("Error:", e.message);
        }
    }
}
testUrls();
