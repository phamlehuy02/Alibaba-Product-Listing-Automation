import CryptoJS from 'crypto-js';

export interface AlibabaConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  refreshToken?: string;
}

export class AlibabaAPI {
  private config: AlibabaConfig;
  private baseUrl = 'https://openapi-auth.alibaba.com/rest';

  constructor(config: AlibabaConfig) {
    this.config = config;
  }

  /**
   * IOP Signing Algorithm (verified against official Lazada IOP SDK):
   * 1. Sort all params by key (ASCII order), exclude 'sign' and empty values
   * 2. Concatenate: apiPath + key1 + value1 + key2 + value2 ...
   * 3. HMAC-SHA256 with appSecret as key
   * 4. Uppercase hex output
   */
  private generateSign(apiPath: string, params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    
    let signStr = apiPath;
    
    for (const key of sortedKeys) {
      if (key !== 'sign' && params[key] !== undefined && params[key] !== '') {
        signStr += key + params[key];
      }
    }

    const hash = CryptoJS.HmacSHA256(signStr, this.config.appSecret);
    return hash.toString(CryptoJS.enc.Hex).toUpperCase();
  }

  /**
   * Build the standard IOP system parameters included in every request.
   */
  private getSystemParams(): Record<string, string> {
    const params: Record<string, string> = {
      app_key: this.config.appKey,
      timestamp: Date.now().toString(),
      sign_method: 'sha256',
      format: 'json',
    };

    if (this.config.accessToken) {
      params.session = this.config.accessToken;
    }

    return params;
  }

  /**
   * Execute a signed IOP API request.
   */
  private async execute(apiPath: string, bizParams: Record<string, string> = {}): Promise<any> {
    const systemParams = this.getSystemParams();
    const allParams = { ...systemParams, ...bizParams };
    const sign = this.generateSign(apiPath, allParams);
    
    const body = new URLSearchParams({ ...allParams, sign }).toString();
    const url = `${this.baseUrl}${apiPath}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
    });

    const data = await response.json();

    // IOP error responses have a 'code' field (e.g. 'IncompleteSignature', 'InvalidSession')
    if (data.code && data.code !== '0') {
      const errorMsg = `Alibaba API Error [${data.code}]: ${data.message || data.msg || 'Unknown error'}`;
      console.error(errorMsg, { request_id: data.request_id });
      throw new Error(errorMsg);
    }

    return data;
  }

  async addProduct(productData: any) {
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

    return this.execute('/alibaba/icbu/product/add', bizParams);
  }

  async exchangeCodeForToken(code: string, redirectUri?: string) {
    const apiPath = '/auth/token/create';
    const params: Record<string, string> = {
      app_key: this.config.appKey,
      code: code,
      timestamp: Date.now().toString(),
      sign_method: 'sha256',
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

    // Check for IOP-level errors
    if (data.code && data.code !== '0') {
      throw new Error(`Token exchange failed [${data.code}]: ${data.message || data.msg || 'Unknown error'}`);
    }

    if (data.access_token) {
      this.config.accessToken = data.access_token;
      this.config.refreshToken = data.refresh_token;
    }
    return data;
  }

  async refreshToken() {
    if (!this.config.refreshToken) throw new Error('No refresh token available');

    const apiPath = '/auth/token/refresh';
    const params: Record<string, string> = {
      app_key: this.config.appKey,
      refresh_token: this.config.refreshToken,
      timestamp: Date.now().toString(),
      sign_method: 'sha256',
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

    if (data.code && data.code !== '0') {
      throw new Error(`Token refresh failed [${data.code}]: ${data.message || data.msg || 'Unknown error'}`);
    }

    if (data.access_token) {
      this.config.accessToken = data.access_token;
      this.config.refreshToken = data.refresh_token;
    }
    return data;
  }
}
