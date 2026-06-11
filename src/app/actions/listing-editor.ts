'use server';

import { getAuthorizedApiClient } from '@/lib/api-client';
import { AlibabaAPI } from '@/lib/alibaba-api';
import { buildListingSnapshotV2, type ListingSnapshot } from '@/lib/listing-v2-compare';

export async function loadListingEditorAction(
  productId: string
): Promise<{ success: true; snapshot: ListingSnapshot } | { success: false; error: string }> {
  const api = await getAuthorizedApiClient();
  if (!api) {
    return { success: false, error: 'Not connected to Alibaba.' };
  }

  try {
    const getRes = await api.getProductV2(productId.trim());
    const productInfo = AlibabaAPI.extractProductInfoV2(getRes);
    if (!productInfo) {
      return { success: false, error: 'Product not found.' };
    }
    return {
      success: true,
      snapshot: buildListingSnapshotV2(productId.trim(), productInfo),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
