# Alibaba IOP API SDK (reference)

Vendored from `com.global.iop:iop-api-sdk` (internal pom version **1.3.5-ae**).

This JAR is **not executed** by the TypeScript app. It documents the official Java client behavior for **Product V2** (`REST_VND_2` protocol).

## Protocols (`com.global.iop.domain.Protocol`)

| Protocol | Executor | URL pattern |
|----------|----------|-------------|
| `GOP` | `GopExecutor` | `{serverUrl}/rest{apiPath}` |
| `TOP` | `TopExecutor` | `{serverUrl}/sync?method=...` |
| `REST_VND_2` | `GopRestExecutor` | `{serverUrl}/rest/2.0{resolvedApiPath}` (Java SDK) |

**Note:** In production Open Platform, Product V2 endpoints such as `/alibaba/icbu/product/search/v2` use the same GOP `/rest` base as v1; the `/v2` suffix is on the API path. Our TypeScript client uses `executeV2()` as an alias to GOP `execute()`.

Product V2 endpoints use **`REST_VND_2`**.

## Path parameters

API paths may include `{paramName}` segments. Values are taken from request params, substituted into the URL, and removed from the signed body (see `GopRestExecutor.getUrl`).

Example:

```
/alibaba/icbu/product/get/v2/{productId}
  + productId=12345
  → /alibaba/icbu/product/get/v2/12345
```

## Signing (GOP / REST_VND_2)

1. Sort all params by key (ASCII), exclude `sign` and empty values.
2. Concatenate: `apiPath + key1 + value1 + key2 + value2 + ...`
3. HMAC-SHA256 with `appSecret`, uppercase hex.

**REST_VND_2** signs the **resolved** path (after `{param}` substitution). There is **no** `method` form field (unlike GOP v1).

## System parameters

- `app_key`, `access_token`, `timestamp` (milliseconds), `sign_method=sha256`, `partner_id`, `sign`

## TypeScript implementation

See [`src/lib/alibaba-api.ts`](../../src/lib/alibaba-api.ts) `executeV2()`.
