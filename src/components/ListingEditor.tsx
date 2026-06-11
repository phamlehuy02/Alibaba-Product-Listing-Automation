'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { loadListingEditorAction } from '@/app/actions/listing-editor';
import type { ListingSnapshot } from '@/lib/listing-v2-compare';

type CampaignRow = {
  id: string;
  name: string;
  template?: { baseProductId?: string; category?: string | number };
};

type Props = {
  campaign: CampaignRow;
  onBack: () => void;
};

export default function ListingEditor({ campaign, onBack }: Props) {
  const productId = String(campaign.template?.baseProductId || '').trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ListingSnapshot | null>(null);

  const load = useCallback(async () => {
    if (!productId) {
      setError('No product ID on this campaign.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await loadListingEditorAction(productId);
    if (res.success === false) {
      setError(res.error);
    } else {
      setSnapshot(res.snapshot);
    }
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-secondary" onClick={onBack}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div>
          <h2 className="page-title">{campaign.name}</h2>
          <p className="page-description">Product V2 read-only view · ID {productId}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
          Refresh
        </button>
      </header>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {snapshot && (
        <div className="card">
          <p>
            <strong>Title:</strong> {snapshot.subject}
          </p>
          <p>
            <strong>Description:</strong> {snapshot.descriptionHtml.length.toLocaleString()} chars
          </p>
          <p>
            <strong>Images:</strong> {snapshot.images.length}
          </p>
          <pre className="compare-raw" style={{ maxHeight: 480, overflow: 'auto' }}>
            {JSON.stringify(snapshot.rawProductInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
