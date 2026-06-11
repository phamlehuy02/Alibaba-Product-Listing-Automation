/** Alibaba ICBU Product V2 API shapes (refined via probe + live responses). */

export type AiOptimizationConfig = {
  title_optimization_enabled?: boolean;
  description_optimization_enabled?: boolean;
  keyword_optimization_enabled?: boolean;
};

export type ProductInfoV2 = Record<string, unknown>;

export type ListingV2Request = {
  product_info: ProductInfoV2;
  ai_optimization_config?: AiOptimizationConfig;
};

export type ProductBriefV2 = {
  product_id?: string | number;
  id?: string | number;
  subject?: string;
  title?: string;
  gmt_modified?: string;
  gmt_create?: string;
  category_id?: string | number;
  [key: string]: unknown;
};

export type SearchProductsV2Options = {
  page?: number;
  pageSize?: number;
  language?: string;
  gmtModifiedFrom?: string;
  gmtModifiedTo?: string;
  subject?: string;
  productId?: string | number;
  categoryId?: string | number;
};
