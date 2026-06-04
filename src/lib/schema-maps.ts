/**
 * schema-maps.ts
 *
 * Single source-of-truth for all Alibaba schema field option IDs and
 * company-specific certificate definitions.
 *
 * Values are extracted from the live schema XML (scratch/schema-full.xml).
 * Update here if Alibaba changes option IDs for category 100009031.
 */

// ── Product Attribute Option Maps ──────────────────────────────────────────

/** p-19127: Variety (singleCheck) */
export const VARIETY_IDS: Record<string, string> = {
  Arabica:  '12692442',
  Robusta:  '11352458',
  Liberica: '1875805655',
  Java:     '3231095',
};

/**
 * p-19122: Processing Type (multiCheck)
 * Note: Roasted = the processing state, not the growing method.
 * Both Washed and Natural processes produce "Roasted" beans after roasting.
 */
export const PROCESSING_TYPE_IDS: Record<string, string> = {
  Roasted:          '54610994',
  Green:            '216016296',
  Blended:          '44945365',
  Fermented:        '1875805659',
  Washed:           '54610994', // Washed + Roasted → Roasted
  'Natural (Dry)':  '54610994', // Natural + Roasted → Roasted
  'Honey Processed':'54610994',
  'Giling Basah':   '54610994',
};

/** p-19112: Cultivation Type (singleCheck) */
export const CULTIVATION_TYPE_IDS: Record<string, string> = {
  Organic: '3362309',
  GMO:     '4513555',
  COMMON:  '7980811',
  Common:  '7980811',
};

/**
 * p-1: Place of Origin (singleCheck).
 * Keys should match strings that appear in campaign.template.origin.
 * Matching is done with .toLowerCase().includes(key.toLowerCase()).
 */
export const ORIGIN_IDS: Record<string, string> = {
  Vietnam:   '100000646',
  Brazil:    '100000444',
  Ethiopia:  '100000483',
  Indonesia: '100000515',
  Colombia:  '100000461',
  India:     '100000514',
  Kenya:     '100000525',
  Guatemala: '100000504',
  Honduras:  '100000510',
  Peru:      '100000583',
  Mexico:    '100000551',
  Tanzania:  '100000624',
  Uganda:    '100000635',
};

// ── Company Certificate Definitions ────────────────────────────────────────

/**
 * These are the company's pre-registered certificates in the Alibaba platform.
 * The `id` values come from <options> in the live productCertificate schema field.
 * The `number`, `type`, and `body` attributes are required by the XML syntax.
 */
export interface CompanyCert {
  id:     string;  // Alibaba certificate option value
  number: string;  // Certificate number / issuer name
  type:   string;  // Usually "PRODUCT"
  body:   string;  // Certification body
  name:   string;  // Human-readable label (for logging)
}

export const COMPANY_CERTS: CompanyCert[] = [
  {
    id:     '40004993605',
    number: 'Detech Coffee JSC',
    type:   'PRODUCT',
    body:   'Other',
    name:   'Self-Declaration for Sellers of food - EU & UK',
  },
  {
    id:     '30001679330',
    number: '13730848004',
    type:   'PRODUCT',
    body:   'Other',
    name:   'FDA qualification of food enterprise',
  },
];
