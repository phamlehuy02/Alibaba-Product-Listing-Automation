const fetch = require('node-fetch');

async function exchange() {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: '3_502296_R9TZtH18IXhexXsHDmyDjQJ221',
    client_id: '502296',
    client_secret: 'vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V',
    redirect_uri: 'https://example.com/callback',
  });

  const url = 'https://openapi-auth.alibaba.com/auth/token/create';
  
  console.log('Exchanging code for token...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

exchange();
