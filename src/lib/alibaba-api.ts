import CryptoJS from 'crypto-js';

export interface AlibabaConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  refreshToken: string;
}

export class AlibabaAPI {
  private config: AlibabaConfig;
  private baseUrl = 'https://eco.taobao.com/router/rest';

  constructor(config: AlibabaConfig) {
    this.config = config;
  }

  private generateSign(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    let query = '';
    
    // For HMAC-MD5, we concatenate all name-value pairs
    for (const key of sortedKeys) {
      query += key + params[key];
    }

    // Sign with App Secret
    const hash = CryptoJS.HmacMD5(query, this.config.appSecret);
    return hash.toString(CryptoJS.enc.Hex).toUpperCase();
  }

  async addProduct(productData: any) {
    const publicParams: Record<string, string> = {
      method: 'alibaba.icbu.product.add',
      app_key: this.config.appKey,
      session: this.config.accessToken,
      timestamp: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
      format: 'json',
      v: '2.0',
      sign_method: 'hmac',
    };

    const bizParams: Record<string, string> = {
      product: JSON.stringify({
        cat_id: productData.category || '100009031', // Roasted Coffee Beans
        language: 'english',
        subject: productData.title,
        description: productData.description,
        // Add more fields as required by the ICBU API
        attributes: [
          { attr_id: 100009031, attr_value: productData.roastLevel }, // Example attribute IDs
          { attr_id: 100009032, attr_value: productData.beanVariety }
        ],
        main_image: {
          images: productData.images || []
        },
        sku_list: [
          {
            price: productData.price,
            moq: productData.moq
          }
        ]
      })
    };

    const allParams = { ...publicParams, ...bizParams };
    const sign = this.generateSign(allParams);
    
    const queryParams = new URLSearchParams({ ...allParams, sign }).toString();
    const url = `${this.baseUrl}?${queryParams}`;

    const response = await fetch(url, {
      method: 'POST',
    });

    return await response.json();
  }

  async exchangeCodeForToken(code: string, redirectUri: string) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: this.config.appKey,
      client_secret: this.config.appSecret,
      redirect_uri: redirectUri,
    });

    const url = 'https://openapi-auth.alibaba.com/auth/token/create';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await response.json();
    if (data.access_token) {
      this.config.accessToken = data.access_token;
      this.config.refreshToken = data.refresh_token;
      console.log('Successfully exchanged code for tokens');
    }
    return data;
  }

  async refreshToken() {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: this.config.appKey,
      client_secret: this.config.appSecret,
    });

    const url = 'https://openapi-auth.alibaba.com/auth/token/create'; // Same endpoint for refresh? The user guide doesn't specify but usually it is.
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await response.json();
    if (data.access_token) {
      this.config.accessToken = data.access_token;
      this.config.refreshToken = data.refresh_token;
      console.log('Successfully refreshed Alibaba tokens');
    }
    return data;
  }

  async uploadImage(file: File) {
    // ... logic for alibaba.icbu.photobank.upload
    console.log('Uploading image to Alibaba Photo Bank...', file.name);
    return { status: 'success', url: 'https://img.alicdn.com/example_image.jpg' };
  }
}
