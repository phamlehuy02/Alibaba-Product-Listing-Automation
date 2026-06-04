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
  private apiBaseUrl = 'https://openapi-api.alibaba.com/rest';

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
      format: 'json',
      sign_method: 'sha256',
      timestamp: Date.now().toString(), // milliseconds
    };

    if (this.config.accessToken) {
      params.access_token = this.config.accessToken;
    }

    return params;
  }

  /**
   * Execute a signed IOP API request.
   */
  private async execute(apiPath: string, bizParams: Record<string, string> = {}): Promise<any> {
    const systemParams = this.getSystemParams();
    
    // GOP Protocol requires the apiPath to be passed as the 'method' parameter
    const allParams = { ...systemParams, ...bizParams, method: apiPath };
    const sign = this.generateSign(apiPath, allParams);
    
    const body = new URLSearchParams({ ...allParams, sign }).toString();
    const url = `${this.apiBaseUrl}${apiPath}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Protocol': 'GOP'
      },
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
        product_video: productData.videoId ? {
          video_id: productData.videoId
        } : undefined,
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

  async addProductRaw(productJson: any) {
    const bizParams: Record<string, string> = {
      product: typeof productJson === 'string' ? productJson : JSON.stringify(productJson)
    };
    return this.execute('/alibaba/icbu/product/add', bizParams);
  }

  async addProductSchema(catId: number, xml: string) {
    const payload = {
      cat_id: catId,
      xml: xml,
      language: 'english'
    };
    const bizParams: Record<string, string> = {
      publish_request: JSON.stringify(payload)
    };
    const res = await this.execute('/icbu/product/schema/add', bizParams);
    // Log raw response once so we can confirm the product_id field location
    console.log('[addProductSchema raw]', JSON.stringify(res).substring(0, 300));
    return res;
  }

  async getProductSchema(productId: string, catId: string) {
    const bizParams: Record<string, string> = {
      product_id: productId,
      cat_id: catId,
      language: 'english'
    };
    const res = await this.execute('/alibaba/icbu/product/schema/get', bizParams);
    // API returns XML in result.data (primary), or legacy fields as fallback
    return res.alibaba_icbu_product_schema_get_response?.schema ||
           res.result?.schema ||
           res.result?.data ||
           res.schema ||
           res.xml;
  }

  async exchangeCodeForToken(code: string, redirectUri?: string) {
    const apiPath = '/auth/token/create';
    const params: Record<string, string> = {
      app_key: this.config.appKey,
      code: code,
      format: 'json',
      sign_method: 'sha256',
      timestamp: Date.now().toString(), // milliseconds
    };

    const sign = this.generateSign(apiPath, params);
    params.sign = sign;

    console.log('🔑 Exchanging code for token...');
    console.log('  URL:', `${this.baseUrl}${apiPath}`);
    console.log('  Params:', JSON.stringify({ ...params, sign: params.sign.substring(0, 8) + '...' }));

    const url = `${this.baseUrl}${apiPath}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });

    const data = await response.json();
    console.log('  Response:', JSON.stringify(data));

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
      format: 'json',
      refresh_token: this.config.refreshToken,
      sign_method: 'sha256',
      timestamp: Date.now().toString(), // milliseconds
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
      this.config.refreshToken = data.refresh_token || this.config.refreshToken;
    }
    return data;
  }

  /**
   * List groups from Alibaba Photobank.
   */
  async listPhotobankGroups() {
    return this.execute('/icbu/product/photobank/group/list', {});
  }

  /**
   * List images from Alibaba Photobank.
   */
  async listPhotobankImages(groupId: string, page = 1, pageSize = 20) {
    const bizParams: Record<string, string> = {
      groupId: groupId,
      currentPage: page.toString(),
      pageSize: pageSize.toString(),
    };

    return this.execute('/icbu/product/photobank/list', bizParams);
  }

  /**
   * Query videos from Alibaba Video Center.
   */
  async queryVideos(page = 1, pageSize = 10, title?: string) {
    const bizParams: Record<string, string> = {
      current_page: page.toString(),
      page_size: pageSize.toString(),
    };

    if (title) {
      bizParams.title = title;
    }

    return this.execute('/alibaba/icbu/video/query', bizParams);
  }

  /**
   * List products from Alibaba.
   */
  async listProducts(page = 1, pageSize = 10) {
    const bizParams: Record<string, string> = {
      current_page: page.toString(),
      page_size: pageSize.toString(),
    };

    return this.execute('/alibaba/icbu/product/list', bizParams);
  }

  /**
   * Get product details from Alibaba.
   */
  async getProduct(productId: string) {
    try {
      const bizParams: Record<string, string> = {
        product_id: productId,
      };
      const apiRes = await this.execute('/alibaba/icbu/product/get', bizParams);
      if (apiRes.alibaba_icbu_product_get_response?.product || apiRes.result?.product || apiRes.product) {
        return apiRes;
      }
      throw new Error('No product found in API response');
    } catch (apiError: any) {
      console.warn(`API getProduct failed for ${productId}, falling back to scraping:`, apiError.message);
      try {
        const url = `https://www.alibaba.com/product-detail/a_${productId}.html`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (!res.ok) {
          throw new Error(`HTTP status ${res.status}`);
        }
        const html = await res.text();
        const cleanText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
        
        let title = '';
        let description = '';
        let price = '10.00';
        let images: string[] = [];
        let videoId: string | undefined;

        const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        if (match) {
          const data = JSON.parse(match[1].trim());
          const product = Array.isArray(data) ? data.find((x: any) => x['@type'] === 'Product') : data;
          const video = Array.isArray(data) ? data.find((x: any) => x['@type'] === 'VideoObject') : null;
          
          title = product?.name || '';
          description = product?.description || '';
          price = product?.offers?.price || '10.00';
          images = product?.image || [];
          
          if (video?.contentUrl) {
            const videoIdMatch = video.contentUrl.match(/\/(\d+)\.mp4/);
            if (videoIdMatch) {
              videoId = videoIdMatch[1];
            }
          }
        }

        let moq = '100kg';
        const moqMatch = cleanText.match(/Minimum\s+order\s+quantity:\s*([\d\.]+\s*[a-zA-Z]+)/i) || 
                         cleanText.match(/Min\.\s+order:\s*([\d\.]+\s*[a-zA-Z]+)/i);
        if (moqMatch) {
          moq = moqMatch[1].trim();
        }

        return {
          alibaba_icbu_product_get_response: {
            product: {
              subject: title,
              description: description,
              main_image: {
                images: images
              },
              product_video: videoId ? {
                video_id: videoId
              } : undefined,
              sku_info: {
                sku_list: [
                  {
                    price: price,
                    moq: moq
                  }
                ]
              },
              category_id: 100009031
            }
          }
        };
      } catch (scrapeError: any) {
        throw new Error(`Failed to fetch product via API and Scraping: ${scrapeError.message}`);
      }
    }
  }
}
