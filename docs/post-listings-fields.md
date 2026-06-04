# Post listings — field-by-field reference

This document describes what **Post listings** fills on each new Alibaba product listing.

**Flow:** clone an existing product’s schema XML → overwrite specific fields → strip a few blocks → submit as a new product.

For products **imported from Alibaba**, the campaign template is mostly the list row (title, price, MOQ, category, images) plus these **defaults** if nothing else was saved:

| Default | Value |
|---------|--------|
| Variety | Arabica |
| Origin | Vietnam |
| Processing | Washed |
| MOQ | 100 |
| Price | 10.00 USD |
| Brand | Detech Coffee (or `ALIBABA_BRAND_NAME` from env) |

**AI is off** — title and description are not rewritten. They come from the template (or stay empty).

---

## How to read this list

| Source | Meaning |
|--------|---------|
| **Overwritten** | Bot sets this every time |
| **From template** | Your campaign / import data in `campaigns.json` |
| **From base product** | Cloned from the product in `template.baseProductId` |
| **From base + API** | Base product details via `getProduct` (when that works) |
| **Hardcoded** | Fixed in code |
| **From clone only** | Whatever was already in the cloned schema; bot does not change it |
| **Removed** | Stripped before submit |

---

## Basic listing info

### 1. Product name (`productTitle`) — Overwritten

- **Value:** `campaign.template.title` (for imports: Alibaba subject / product name).
- AI does not change it.

### 2. Product description (`superText`) — Overwritten only if non-empty

- **Value:** `campaign.template.description`.
- For most **imported** products this is **empty**, so the bot often **does not** inject description → the **cloned base product’s** description (if any) may remain in the XML until publish prep.

### 3. Category (`catId` + API `cat_id`) — Overwritten at publish

- **Value:** `campaign.template.category` (import: `category_id` from list), fallback `100009031` (roasted coffee).
- Cloning uses the same category as the **base product** you’re copying.

### 4. Type of product (`market`) — Usually from clone

- Not explicitly set by the bot.
- Typically stays whatever the **base product** had (often “Ready to ship” = `1`).

---

## Images & video

### 5. Product images (`scImages` → `scImages_0` … `scImages_5`) — Overwritten when images are found

Up to **6** slots. Each gets Photobank **URL + `fileId`**.

**Priority:**

1. **Campaign images** (`campaign.images` from import) matched to your Photobank by URL hash
2. Else **base product** main images → same Photobank matching
3. Else **Photobank group** by product type:
   - Green beans → `"Green bean coffee"`
   - Drip bag → `"Coffee filter bag"`
   - Otherwise → `"Roasted Coffee "`
   - → first 6 images from that group

If none resolve, image slots may stay empty or keep clone values (risky for approval).

### 6. Product video (`imageVideo`) / Additional videos (`detailVideo`) — Usually from clone

- Bot only passes through `campaign.video_id` if set (imports usually don’t).
- Otherwise **base product** video from cloned schema.

---

## Search & discovery

### 7. Product keywords (`productKeywords_0`, `_1`, `_2`) — Overwritten

Three keyword lines (sanitized, max ~120 chars each).

**Priority:**

1. Parse **base product** keywords from `getProduct` (split by comma / words)
2. Else **defaults** by `productType`:
   - **Green:** green-coffee phrases
   - **Drip bag / ground / roasted:** matching coffee phrases
   - **Default import** (often no `productType`): `"Coffee Beans"`, `"Specialty Coffee"`, `"Vietnam Coffee"`

---

## Pricing & MOQ

### 8. Price setting (`scPrice`) — Overwritten → `1`

- `1` = **Tiered pricing by quantity**.

### 9. Market price setting (`marketPrice`) — Overwritten → `1`

- Also set to tiered-by-quantity mode for market listing.

### 10. Quantity price / ladder price (`ladderPrice_0` … `_3`) — Overwritten

Each tier: **MOQ quantity** + **USD price per unit**.

**Priority:**

1. **Base product** `wholesaleTrade.priceRanges` (if API returns them)
2. Else built from **template** + fallbacks:
   - **Tier 0:** template MOQ + price (import defaults often `100` / `10.00`)
   - **Tier 1:** 10× MOQ, ~5% lower price
   - **Tier 2:** 50× MOQ, ~10% lower
   - **Tier 3:** 100× MOQ, ~15% lower

If you created a campaign in the form with `priceTiers`, those can also fill `ladderPrice_*` earlier in `injectStructuredAttributes` (then wholesale pricing runs again and sets tiers again).

### 11. Minimum order quantity (`minOrderQuantity`) — Overwritten

- Numeric MOQ from `campaign.template.moq` (import: list API or default `100`).

### 12. MOQ for market listing (`marketMinOrderQuantity`) — Overwritten

- Same numeric MOQ as above.

### 13. Unit (`priceUnit`) — Overwritten

- Maps **base product** unit text to Alibaba unit IDs (e.g. Kilogram → `16`, Gram → `17`, Bag → `1`, Ton → `11`, etc.).
- Default if unknown: **Kilogram** (`16`).

### 14. FOB / range price (`fob`) — From clone

- Not filled by the bot; stays from **base product** schema if present.

---

## Shipping / lead time

### 15. Shipping (`ladderPeriod` → `ladderPeriod_0` … `_2`) — Overwritten

Three tiers: **quantity** + **estimated lead time (days)**.

**Priority:**

1. **Base product** `wholesaleTrade.deliverPeriods` (up to 3)
2. Else defaults, then bot **pads to 3 tiers**, e.g.:
   - 10,000 units / 15 days
   - 20,000 / 20 days
   - 100,000 / 30 days (extrapolated)

---

## Product attributes (coffee category — `icbuCatProp` and related)

These use Alibaba internal IDs (`p-xxxxx`). Seller-facing names below.

### 16. Variety (`p-19127`) — Overwritten if mapped

- Template `beanVariety` → option ID (import default **Arabica**).

### 17. Place of origin (`p-1`) — Overwritten if matched

- Template `origin` fuzzy-matched (import default **Vietnam**).

### 18. Processing type (`p-19122`, multi-select) — Overwritten

- `productType === 'green-beans'` → **Green**
- Else `processing` name (import default **Washed**) → usually mapped to **Roasted** in schema (code maps washed/natural to roasted IDs for this field).

### 19. Cultivation type (`p-19112`) — Overwritten

- **Organic** if `certifications` contains “organic”; else **COMMON**.

### 20. Brand name (`p-2`) — Overwritten

- `template.brandName` or env `ALIBABA_BRAND_NAME` or **Detech Coffee**.

### 21. Shelf life (`p-191286392`) — Only if template has it

- Import path usually **skips** (no default in sync).

### 22. Packaging (`p-191286084`) — Only if template has it

- `template.packagingType` (e.g. from manual campaign form).

### 23. Max. moisture % (`p-19136`) — Only if template has it

- Numeric only, stripped from strings like `"< 12.5%"`.

### 24. Product certifications (`productCertificate`) — Overwritten

Always both certs from `src/lib/schema-maps.ts`:

- Self-Declaration for Sellers of food – EU & UK
- FDA qualification of food enterprise

(with fixed certificate numbers/types in XML)

### 25. Other category attributes — Mostly from clone

Examples that often stay from the **base product** because the bot does not touch them:

- Storage type, specification, type, manufacturer, ingredients, content, address, instruction for use, grade, weight, taste, roast type, feature, Brix, model number, etc.

Whatever was on the product you cloned.

---

## Trade extras (removed or unchanged)

### 26. Customization content (`customizedServices`) — Removed

- Entire block dropped before publish (empty customization rows caused API errors).

### 27. Payment options (`paymentMethod`) — Removed

- Entire block dropped before publish.

### 28. More details (`customMoreProperty`) — Removed

- Entire block dropped, even if you set **custom attributes** in the New campaign form (that injection is undone by removal).

### 29. Product group (`productGroup`) — From clone

- Not set by bot.

---

## Logistics / packaging / SKU (usually unchanged)

### 30. Dimensions (`pkgMeasure`), gross weight (`pkgWeight`), product specification (`pkgSpecification`) — From clone

### 31. SKU / sample SKU / sales property / inventory — From clone

- Bot does not build SKU matrices for the new listing.

### 32. Customization toggle (`productLightCustom`) — From clone

---

## What is *not* filled (important gaps for pending review)

- **Rich HTML description** — often blank on imports → weak or cloned-only description.
- **Many category-specific attrs** — only what the **base** product had.
- **Customization & payment blocks** — removed, not filled.
- **“More details” custom rows** — removed.
- **True AI variations** — disabled; same title as source unless you edited the campaign.

---

## Practical summary for imported products

For a typical **Load from Alibaba** row, the bot actively sets:

| Seller-facing area | What you get |
|--------------------|--------------|
| Title | Same as original listing title |
| Images | Photobank images (often from “Roasted Coffee” group, not necessarily that SKU’s photos) |
| Keywords | From base product or generic coffee keywords |
| MOQ / tier prices | MOQ **100**, price **$10**, synthetic higher-qty tiers |
| Origin / variety / processing | **Vietnam** / **Arabica** / **Washed→Roasted** defaults |
| Brand | **Detech Coffee** |
| Certs | Your two configured food certs |
| Shipping lead times | Base product or 10k/15d style defaults |

Everything else is mostly **whatever was on the cloned base product’s schema**, which is why new listings can look like duplicates, miss description edits, and sit in **Pending** until Alibaba reviews them.

---

## Debug payloads

After each run, the server may write:

- `scratch/post-payload-raw.xml` — XML after injections, before publish formatting
- `scratch/post-payload.xml` — XML sent to Alibaba (`<complex-value>`, stripped blocks)

These files are gitignored and only exist on the machine running `npm run dev` or `npm run post-now`.
