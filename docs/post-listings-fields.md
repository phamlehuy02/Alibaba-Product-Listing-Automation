# Duplicate listings — field reference

**Post listings** duplicates existing Alibaba products via **schema/render → schema/add** (live publish), then optional **listing/v2** AI optimization.

**Flow:** `search/v2` (date range) + `campaigns.json` fallback → `get/v2` + `schema/render` source → inject title, images, custom HTML description → `schema/add` → optional `listing/v2` AI flags.

**Description (important):**

- Source products edited with **Smart editing** store `basic_info.description` as a large JSON string (`description`, `pageData`, `pageId`, `staticResource`).
- The schema API does **not** expose `pageData`; duplication injects the inner HTML into `superText` with `productDescType=2` (custom description).
- Live `schema/add` allows at most **30** inline description images; sources with 31 images are capped on publish.
- `/compare` treats descriptions as matching when canonical HTML matches (unwrap JSON → cap at 30 images). Wire format will still differ (JSON vs HTML).

**Title:** [`rearrangeTitleMinimalUnique`](../src/lib/title-rearranger.ts) seeds `productTitle`, then optional listing/v2 AI refines it.

**Images:** `schema/render` URLs without `fileId` are re-uploaded to Photobank before publish (`CHK_IMAGE_FILE_ID_EMPTY` otherwise). Clone image URLs differ from source but content is preserved.

**Output:** source→clone pairs appended to [`scratch/listing-pairs.json`](../scratch/listing-pairs.json).

**pageData:** only returned inside `get/v2` `basic_info.description` JSON on smart-editing sources. `schema/render` exposes an empty `multilangInfo` shell; `listing/v2` create/update converts description to custom HTML. Open Platform docs state API supports custom description only.

**Sync / verify:**

- `npx tsx scripts/sync-product-description.ts <sourceId> <cloneId>` — push source HTML to clone via `schema/update`
- `npx tsx scripts/verify-listing-pair.ts <sourceId> <cloneId> --description-only`
- `npx tsx scripts/probe-description-pagedata.ts <sourceId> <cloneId>` — dump probe artifacts to `scratch/description-probe/`
