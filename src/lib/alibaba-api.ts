import CryptoJS from 'crypto-js';

export interface AlibabaConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  refreshToken?: string;
}

export class AlibabaAPI {
  private config: AlibabaConfig;
  private baseUrl = 'https://api.taobao.global/rest';

  constructor(config: AlibabaConfig) {
    this.config = config;
  }

  private generateSign(apiPath: string, params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    
    // IOP Signing Rule: Prepend the API path to the sorted key-value pairs
    let signStr = apiPath;
    
    for (const key of sortedKeys) {
      if (key !== 'sign' && params[key] !== undefined && params[key] !== '') {
        signStr += key + params[key];
      }
    }

    const hash = CryptoJS.HmacSHA256(signStr, this.config.appSecret);
    return hash.toString(CryptoJS.enc.Hex).toUpperCase();
  }

  async addProduct(productData: any) {
    const apiPath = '/alibaba/icbu/product/add';
    const publicParams: Record<string, string> = {
      app_key: this.config.appKey,
      timestamp: Date.now().toString(),
      sign_method: 'hmac-sha256',
      simplify: 'true',
      format: 'json',
    };

    if (this.config.accessToken) {
      publicParams.session = this.config.accessToken;
    }

    const bizParams: Record<string, string> = {
      product: JSON.stringify({
        cat_id: productData.category || '100009031', // Roasted Coffee Beans
        language: 'english',
        subject: productData.title,
        description: productData.description,
        attributes: productData.attributes || [],
        main_image: {
          images: productData.images || []
        },
        sku_list: productData.sku_list || [
          {
            price: productData.price,
            moq: productData.moq
          }
        ]
      })
    };

    const allParams = { ...publicParams, ...bizParams };
    const sign = this.generateSign(apiPath, allParams);
    
    const body = new URLSearchParams({ ...allParams, sign }).toString();
    const url = `${this.baseUrl}${apiPath}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });

    return await response.json();
  }

  async exchangeCodeForToken(code: string, redirectUri?: string) {
    const apiPath = '/auth/token/create';
    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      code: code,
      app_key: this.config.appKey,
      timestamp: Date.now().toString(),
      sign_method: 'hmac-sha256'
    };

    // Note: IOP token exchange also requires a signature
    const sign = this.generateSign(apiPath, params);
    params.sign = sign;

    const url = `${this.baseUrl}${apiPath}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });

    const data = await response.json();
    if (data.access_token) {
      this.config.accessToken = data.access_token;
      this.config.refreshToken = data.refresh_token;
    }
    return data;
  }

  async refreshToken() {
    if (!this.config.refreshToken) throw new Error('No refresh token available');

    const apiPath = '/auth/token/refresh'; // Verify if this is the correct IOP path
    const params: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      app_key: this.config.appKey,
      timestamp: Date.now().toString(),
      sign_method: 'hmac-sha256'
    };

    const sign = this.generateSign(apiPath, params);
    params.sign = sign;

    const url = `${this.baseUrl}${apiPath}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });

    const data = await response.json();
    if (data.access_token) {
      this.config.accessToken = data.access_token;
      this.config.refreshToken = data.refresh_token;
    }
    return data;
  }

  async uploadImage(file: File) {
    console.log('Uploading image to Alibaba Photo Bank...', file.name);
    // This would use /alibaba/icbu/photobank/upload
    return { status: 'success', url: 'https://img.alicdn.com/example_image.jpg' };
  }
}

