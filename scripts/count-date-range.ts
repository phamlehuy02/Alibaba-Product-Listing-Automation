import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { getAuthorizedApiClient } from '../src/lib/api-client';
import { AlibabaAPI } from '../src/lib/alibaba-api';

async function main() {
  const api = await getAuthorizedApiClient();
  const startMs = new Date('2026-05-26T00:00:00').getTime();
  const endMs = new Date('2026-06-01T00:00:00').getTime();
  let inRange = 0;
  let total = 0;
  for (let page = 1; page <= 50; page++) {
    const res = await api!.searchProductsV2({
      page,
      pageSize: 30,
      gmtModifiedFrom: '2026-05-01 00:00:00',
      gmtModifiedTo: '2026-06-10 00:00:00',
    });
    const batch = AlibabaAPI.extractProductListV2(res);
    if (!batch.length) break;
    for (const p of batch) {
      total++;
      const ts = (p as any).basic_info?.last_modified_timestamp;
      if (typeof ts === 'number' && ts >= startMs && ts < endMs) {
        inRange++;
        console.log(inRange, AlibabaAPI.getProductId(p), new Date(ts).toISOString(), AlibabaAPI.getProductTitle(p).slice(0, 60));
      }
    }
    if (batch.length < 30) break;
  }
  console.log('total scanned', total, 'in range', inRange);
}

main();
