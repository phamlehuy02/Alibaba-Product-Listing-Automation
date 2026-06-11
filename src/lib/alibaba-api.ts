import CryptoJS from 'crypto-js';
import { unwrapDescriptionHtml } from './listing-v2-normalizer';
import type {
  AiOptimizationConfig,
  ListingV2Request,
  ProductBriefV2,
  ProductInfoV2,
  SearchProductsV2Options,
} from './listing-v2-types';

export type { AiOptimizationConfig, ListingV2Request, ProductBriefV2, ProductInfoV2 };

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
  /** Product V2 endpoints live on the same GOP `/rest` base; `/v2` is in the path. */

  constructor(config: AlibabaConfig) {
    this.config = config;
  }

  /**
   * IOP signing: apiPath + sorted(key+value), HMAC-SHA256, uppercase hex.
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

  /** GOP v1 system params (includes format + method in body). */
  private getSystemParams(): Record<string, string> {
    const params: Record<string, string> = {
      app_key: this.config.appKey,
      format: 'json',
      sign_method: 'sha256',
      timestamp: Date.now().toString(),
    };
    if (this.config.accessToken) {
      params.access_token = this.config.accessToken;
    }
    return params;
  }

  /**
   * Substitute `{param}` path segments from params (GopRestExecutor behavior).
   * Returns resolved path and params with path keys removed.
   */
  static resolveApiPath(
    apiPath: string,
    params: Record<string, string>
  ): { resolvedPath: string; queryParams: Record<string, string> } {
    const pathParams = new Set<string>();
    const segments = apiPath.split('/').filter(Boolean);
    const resolved: string[] = [];

    for (const segment of segments) {
      if (segment.startsWith('{') && segment.endsWith('}')) {
        const key = segment.slice(1, -1);
        const value = params[key];
        if (!value) {
          throw new Error(`Missing path parameter "${key}" for ${apiPath}`);
        }
        pathParams.add(key);
        resolved.push(value);
      } else {
        resolved.push(segment);
      }
    }

    const resolvedPath = '/' + resolved.join('/');
    const queryParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!pathParams.has(key)) {
        queryParams[key] = value;
      }
    }
    return { resolvedPath, queryParams };
  }

  private checkApiError(data: any): void {
    if (data?.code && data.code !== '0') {
      const errorMsg = `Alibaba API Error [${data.code}]: ${data.message || data.msg || 'Unknown error'}`;
      console.error(errorMsg, { request_id: data.request_id });
      throw new Error(errorMsg);
    }
  }

  /** GOP v1 — photobank, video, legacy helpers only. */
  private async execute(apiPath: string, bizParams: Record<string, string> = {}): Promise<any> {
    const systemParams = this.getSystemParams();
    const allParams = { ...systemParams, ...bizParams, method: apiPath };
    const sign = this.generateSign(apiPath, allParams);
    const body = new URLSearchParams({ ...allParams, sign }).toString();
    const url = `${this.apiBaseUrl}${apiPath}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Protocol': 'GOP',
      },
      body,
    });

    const data = await response.json();
    this.checkApiError(data);
    return data;
  }

  /**
   * Product V2 endpoints use GOP on `/rest` with `/v2` in the API path (not `/rest/2.0`).
   */
  async executeV2(
    apiPath: string,
    bizParams: Record<string, string> = {},
    _options?: { httpMethod?: 'GET' | 'POST' }
  ): Promise<any> {
    return this.execute(apiPath, bizParams);
  }

  private async executeMultipart(
    apiPath: string,
    bizParams: Record<string, string>,
    fileField: string,
    fileBuffer: Buffer,
    fileName: string
  ): Promise<any> {
    const systemParams = this.getSystemParams();
    const allParams = { ...systemParams, ...bizParams, method: apiPath };
    const sign = this.generateSign(apiPath, allParams);

    const form = new FormData();
    for (const [key, value] of Object.entries(allParams)) {
      form.append(key, value);
    }
    form.append('sign', sign);
    form.append(fileField, new Blob([new Uint8Array(fileBuffer)]), fileName);

    const response = await fetch(`${this.apiBaseUrl}${apiPath}`, {
      method: 'POST',
      headers: { 'X-Protocol': 'GOP' },
      body: form,
    });

    const data = await response.json();
    this.checkApiError(data);
    return data;
  }

  // ─── Product V2 ───────────────────────────────────────────────────────────

  async searchProductsV2(options: SearchProductsV2Options = {}) {
    const bizParams: Record<string, string> = {
      current_page: String(options.page ?? 1),
      page_size: String(Math.min(options.pageSize ?? 30, 30)),
      language: options.language ?? 'ENGLISH',
    };
    if (options.gmtModifiedFrom) bizParams.gmt_modified_from = options.gmtModifiedFrom;
    if (options.gmtModifiedTo) bizParams.gmt_modified_to = options.gmtModifiedTo;
    if (options.subject?.trim()) bizParams.subject = options.subject.trim();
    if (options.productId != null) bizParams.id = String(options.productId);
    if (options.categoryId != null) bizParams.category_id = String(options.categoryId);

    return this.executeV2('/alibaba/icbu/product/search/v2', bizParams);
  }

  async getProductV2(productId: string) {
    return this.executeV2('/alibaba/icbu/product/get/v2', {
      product_id: String(productId),
      language: 'ENGLISH',
    });
  }

  async createListingV2(payload: ListingV2Request) {
    const bizParams: Record<string, string> = {
      product_info: JSON.stringify(payload.product_info),
    };
    if (payload.ai_optimization_config) {
      bizParams.ai_optimization_config = JSON.stringify(payload.ai_optimization_config);
    }
    return this.executeV2('/alibaba/icbu/product/listing/v2', bizParams);
  }

  /** Extract product_info from get/v2 response. */
  static extractProductInfoV2(apiRes: any): ProductInfoV2 | null {
    const candidates = [
      apiRes?.product_info,
      apiRes?.result?.product_info,
      apiRes?.data?.product_info,
      apiRes?.result?.data?.product_info,
      apiRes?.alibaba_icbu_product_get_v2_response?.product_info,
      apiRes?.result,
      apiRes?.data,
    ];
    for (const c of candidates) {
      if (c && typeof c === 'object' && !Array.isArray(c)) {
        if (
          c.subject ||
          c.title ||
          c.product_id ||
          c.category_info ||
          c.main_image ||
          c.media_info
        ) {
          return c as ProductInfoV2;
        }
      }
    }
    return null;
  }

  /** Extract product list from search/v2 response. */
  static extractProductListV2(apiRes: any): ProductBriefV2[] {
    const roots = [
      apiRes?.product_info,
      apiRes?.products,
      apiRes?.result?.product_info,
      apiRes?.result?.products,
      apiRes?.data?.product_info,
      apiRes?.data?.products,
      apiRes?.alibaba_icbu_product_search_v2_response?.products?.product,
      apiRes?.result?.products?.product,
    ];
    for (const root of roots) {
      if (Array.isArray(root)) return root;
      if (root && typeof root === 'object') return [root];
    }
    return [];
  }

  static extractTotalV2(apiRes: any): number | null {
    const candidates = [
      apiRes?.total_item,
      apiRes?.totalItem,
      apiRes?.total,
      apiRes?.total_count,
      apiRes?.page_info?.total_item,
      apiRes?.page_info?.total,
      apiRes?.result?.total_item,
      apiRes?.result?.total,
      apiRes?.data?.total_item,
    ];
    for (const v of candidates) {
      const n = Number(v);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
    return null;
  }

  static extractNewProductIdFromListing(apiRes: any): string | null {
    const candidates = [
      apiRes?.result?.data,
      apiRes?.product_id,
      apiRes?.product_info?.basic_info?.product_id,
      apiRes?.result?.product_id,
      apiRes?.data?.product_id,
      apiRes?.data,
      apiRes?.result?.data?.product_id,
    ];
    for (const c of candidates) {
      if (c != null && String(c).trim()) return String(c).trim();
    }
    return null;
  }

  static getProductId(brief: ProductBriefV2): string {
    return String(
      brief.product_id ??
        brief.id ??
        (brief as { basic_info?: { product_id?: string | number } }).basic_info?.product_id ??
        ''
    );
  }

  static getProductTitle(brief: ProductBriefV2 | ProductInfoV2): string {
    const info = brief as ProductInfoV2 & {
      basic_info?: { subject?: string; title?: string };
    };
    const t =
      info.basic_info?.subject ??
      info.basic_info?.title ??
      (brief as ProductBriefV2).subject ??
      info.title ??
      info.subject;
    return typeof t === 'string' ? t : '';
  }

  static getGmtModified(brief: ProductBriefV2): string | undefined {
    const info = brief as ProductBriefV2 & {
      basic_info?: {
        gmt_modified?: string;
        gmt_create?: string;
        last_modified_timestamp?: number;
        last_modified?: string;
      };
    };
    const ts = info.basic_info?.last_modified_timestamp;
    if (typeof ts === 'number' && ts > 0) {
      const ms = ts < 1e12 ? ts * 1000 : ts;
      return new Date(ms).toISOString();
    }
    const v =
      brief.gmt_modified ??
      brief.gmt_create ??
      info.basic_info?.last_modified ??
      info.basic_info?.gmt_modified ??
      info.basic_info?.gmt_create;
    return typeof v === 'string' ? v : undefined;
  }

  // ─── Shared helpers (v1 + v2 compatible shapes) ───────────────────────────

  static parseMainImages(product: any): { url: string; fileId: string }[] {
    const images: { url: string; fileId: string }[] = [];
    const v2Images = product?.basic_info?.product_images;
    if (Array.isArray(v2Images)) {
      for (const item of v2Images) {
        const url = item?.image_url ?? item?.url ?? '';
        const fileId = String(item?.file_id ?? item?.fileId ?? item?.image_id ?? '');
        if (url) images.push({ url: String(url), fileId });
      }
      if (images.length) return images;
    }
    const raw =
      product?.main_image?.images ||
      product?.mainImage?.images ||
      product?.main_image?.image_list ||
      [];

    const list = Array.isArray(raw) ? raw : [raw];
    for (const item of list) {
      if (typeof item === 'string' && item.trim()) {
        images.push({ url: item.trim(), fileId: '' });
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const url =
        item.url ||
        item.image_url ||
        item.imageUrl ||
        item.original_url ||
        item.originalUrl ||
        '';
      const fileId = String(
        item.file_id ?? item.fileId ?? item.id ?? item.image_id ?? item.imageId ?? ''
      );
      if (url) images.push({ url: String(url), fileId });
    }
    return images;
  }

  static extractProductDescription(product: any): string {
    if (!product || typeof product !== 'object') return '';
    const basicDesc = product.basic_info?.description;
    if (basicDesc != null) {
      const html = unwrapDescriptionHtml(basicDesc);
      if (html.length > 50) return html;
    }
    if (typeof basicDesc === 'string' && basicDesc.trim().length > 50) {
      return basicDesc.trim();
    }
    const candidates = [
      product.description,
      product.pc_detail,
      product.detail,
      product.product_description,
      product.desc,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 50) return c.trim();
    }
    return '';
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async exchangeCodeForToken(code: string, _redirectUri?: string) {
    const apiPath = '/auth/token/create';
    const params: Record<string, string> = {
      app_key: this.config.appKey,
      code,
      format: 'json',
      sign_method: 'sha256',
      timestamp: Date.now().toString(),
    };
    const sign = this.generateSign(apiPath, params);
    params.sign = sign;

    const response = await fetch(`${this.baseUrl}${apiPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    const data = await response.json();
    if (data.code && data.code !== '0') {
      throw new Error(`Token exchange failed [${data.code}]: ${data.message || data.msg}`);
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
      timestamp: Date.now().toString(),
    };
    const sign = this.generateSign(apiPath, params);
    params.sign = sign;

    const response = await fetch(`${this.baseUrl}${apiPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    const data = await response.json();
    if (data.code && data.code !== '0') {
      throw new Error(`Token refresh failed [${data.code}]: ${data.message || data.msg}`);
    }
    if (data.access_token) {
      this.config.accessToken = data.access_token;
      this.config.refreshToken = data.refresh_token || this.config.refreshToken;
    }
    return data;
  }

  // ─── Media (v1 GOP — no v2 equivalent) ──────────────────────────────────

  async uploadPhotobankImage(
    fileName: string,
    imageBytes: Buffer,
    groupId?: string
  ): Promise<{ url: string; fileId: string }> {
    const bizParams: Record<string, string> = { file_name: fileName };
    if (groupId) bizParams.group_id = groupId;

    const res = await this.executeMultipart(
      '/alibaba/icbu/photobank/upload',
      bizParams,
      'image_bytes',
      imageBytes,
      fileName
    );

    const uploaded =
      res.result?.response_object ||
      res.upload_image_response ||
      res.alibaba_icbu_photobank_upload_response?.upload_image_response ||
      res.result?.upload_image_response;

    const fileId = uploaded?.file_id ?? uploaded?.fileId ?? uploaded?.id;
    let url = uploaded?.photobank_url ?? uploaded?.photobankUrl ?? uploaded?.url;
    if (url?.startsWith('//')) url = `https:${url}`;
    if (!fileId || !url) {
      throw new Error(
        `Photobank upload did not return file_id and url: ${JSON.stringify(res).substring(0, 300)}`
      );
    }
    return { url: String(url), fileId: String(fileId) };
  }

  async listPhotobankGroups() {
    return this.execute('/icbu/product/photobank/group/list', {});
  }

  async listPhotobankImages(groupId: string, page = 1, pageSize = 20) {
    return this.execute('/icbu/product/photobank/list', {
      groupId,
      currentPage: page.toString(),
      pageSize: pageSize.toString(),
    });
  }

  async queryVideos(page = 1, pageSize = 10, title?: string) {
    const bizParams: Record<string, string> = {
      current_page: page.toString(),
      page_size: pageSize.toString(),
    };
    if (title) bizParams.title = title;
    return this.execute('/alibaba/icbu/video/query', bizParams);
  }

  // ─── Schema listing (full-fidelity duplicate) ─────────────────────────────

  async renderProductSchema(productId: string, catId: string | number): Promise<string> {
    const res = await this.execute('/icbu/product/schema/render', {
      render_request: JSON.stringify({
        product_id: String(productId),
        cat_id: Number(catId),
        language: 'english',
      }),
    });
    const xml = res.result?.data || res.data || '';
    if (!xml) throw new Error('Empty schema/render response');
    return xml;
  }

  async renderDraftProductSchema(productId: string, catId: string | number): Promise<string> {
    const res = await this.execute('/icbu/product/schema/render/draft', {
      product_id: String(productId),
      language: 'ENGLISH',
      cat_id: String(catId),
    });
    if (res.result?.success === false) {
      throw new Error(res.result?.msg || 'schema/render/draft failed');
    }
    const xml = res.result?.data || '';
    if (!xml) throw new Error('Empty schema/render/draft response');
    return xml;
  }

  async addProductSchemaDraft(catId: number, xml: string) {
    return this.execute('/icbu/product/schema/add/draft', {
      param_product_top_publish_request: JSON.stringify({
        cat_id: catId,
        xml,
        language: 'english',
      }),
    });
  }

  /** Live publish (not draft) — same XML shape as schema/add/draft. */
  async addProductSchema(catId: number, xml: string) {
    return this.execute('/icbu/product/schema/add', {
      publish_request: JSON.stringify({
        cat_id: catId,
        xml,
        language: 'english',
      }),
    });
  }

  /** Incremental field update on an existing published product. */
  async updateProductSchema(
    productId: string,
    catId: number,
    xml: string,
    language = 'english'
  ) {
    return this.execute('/icbu/product/schema/update', {
      cat_id: String(catId),
      product_id: String(productId),
      language,
      xml,
    });
  }

  static extractSchemaDraftProductId(res: any): string | null {
    const candidates = [
      res?.result?.product_id,
      res?.result?.data,
      res?.product_id,
      res?.data,
    ];
    for (const c of candidates) {
      if (c != null && String(c).trim()) return String(c).trim();
    }
    return null;
  }

  /**
   * Paginated product summaries for dashboard sync (v1 list API).
   * search/v2 requires date filters and is unsuitable for open-ended catalog import.
   */
  async listProducts(page = 1, pageSize = 30, language = 'ENGLISH') {
    return this.execute('/alibaba/icbu/product/list', {
      current_page: String(page),
      page_size: String(Math.min(pageSize, 30)),
      language,
    });
  }

  /** @deprecated Use getProductV2 */
  async getProduct(productId: string) {
    return this.getProductV2(productId);
  }

  /** @deprecated Use extractProductInfoV2 */
  static extractProductFromResponse(apiRes: any): any | null {
    return AlibabaAPI.extractProductInfoV2(apiRes);
  }
}
