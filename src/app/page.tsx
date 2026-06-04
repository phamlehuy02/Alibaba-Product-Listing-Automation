'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Coffee,
  Plus,
  Zap,
  Layers,
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  Play,
} from 'lucide-react';
import ProductForm from '@/components/ProductForm';
import {
  loadCampaignsAction,
  runListingBatchAction,
  syncCampaignsPageAction,
} from '@/app/actions/campaigns';
import Link from 'next/link';
import {
  formatAlibabaLastUpdated,
  formatAlibabaProductStatus,
  sortByLastUpdated,
} from '@/lib/alibaba-product-utils';

const TABLE_PAGE_SIZE = 25;
const LISTING_BATCH_SIZE = 5;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue'>('dashboard');
  const [view, setView] = useState<'dashboard' | 'form'>('dashboard');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [alibabaTotal, setAlibabaTotal] = useState<number | null>(null);
  const [syncProductLimit, setSyncProductLimit] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const [isPosting, setIsPosting] = useState(false);
  const [batchMessage, setBatchMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadCampaigns = useCallback(async () => {
    const { campaigns: data, isAuthenticated: authed, syncProductLimit: limit } =
      await loadCampaignsAction();
    setCampaigns(data);
    setIsAuthenticated(authed);
    if (limit) setSyncProductLimit(limit);
    return { count: data.length, authed };
  }, []);

  const runPagedSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);

    let page = 1;
    let hasMore = true;

    try {
      while (hasMore) {
        const result = await syncCampaignsPageAction(page);
        if (!result.success) {
          setSyncError(result.error || 'Sync failed');
          break;
        }
        if (result.alibabaTotal != null) setAlibabaTotal(result.alibabaTotal);
        hasMore = result.hasMore;
        page++;
      }
    } catch (e: any) {
      setSyncError(e?.message || 'Sync failed');
    } finally {
      await loadCampaigns();
      setIsSyncing(false);
    }
  }, [loadCampaigns]);

  const runListingBatch = useCallback(async () => {
    setIsPosting(true);
    setBatchMessage(null);
    try {
      const result = await runListingBatchAction();
      await loadCampaigns();
      if (result.successful > 0) {
        const partial =
          result.failures?.length
            ? ` ${result.failures.length} attempt(s) failed.`
            : '';
        setBatchMessage({
          type: 'success',
          text: `Posted ${result.successful} of ${result.attempted} new listings.${partial} Check Listing history for details.`,
        });
        setActiveTab('queue');
      } else {
        setBatchMessage({
          type: 'error',
          text: result.error || 'No listings were posted.',
        });
      }
    } catch (e: unknown) {
      setBatchMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Listing batch failed.',
      });
    } finally {
      setIsPosting(false);
    }
  }, [loadCampaigns]);

  useEffect(() => {
    if (view !== 'dashboard') return;
    let cancelled = false;

    (async () => {
      await loadCampaigns();
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [view, loadCampaigns]);

  const filteredCampaigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? campaigns.filter(
          (c) =>
            c.name?.toLowerCase().includes(q) ||
            c.template?.title?.toLowerCase().includes(q) ||
            c.id?.toLowerCase().includes(q)
        )
      : campaigns;
    return sortByLastUpdated(list);
  }, [campaigns, searchQuery]);

  const totalTablePages = Math.max(1, Math.ceil(filteredCampaigns.length / TABLE_PAGE_SIZE));
  const pagedCampaigns = filteredCampaigns.slice(
    (tablePage - 1) * TABLE_PAGE_SIZE,
    tablePage * TABLE_PAGE_SIZE
  );

  useEffect(() => {
    setTablePage(1);
  }, [searchQuery]);

  const historyCampaigns = [...campaigns]
    .filter((c) => c.lastRun)
    .sort((a, b) => new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime());

  const formatLastRun = (lastRun?: string) =>
    lastRun
      ? new Date(lastRun).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const importedCount = campaigns.length;
  const isTableLoading = isSyncing;
  const activeCount = campaigns.filter((c) => c.active).length;
  const canPost = isAuthenticated && activeCount > 0 && !isSyncing && !isPosting;
  const isBusy = isSyncing || isPosting;

  if (view === 'form') {
    return <ProductForm onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Seller dashboard</p>
          <h2 className="page-title">
            Your <span className="highlight">Alibaba products</span>
          </h2>
          <p className="page-description">
            Each row is one product from Manage Products. Use{' '}
            <strong>Load from Alibaba</strong> to fetch the {syncProductLimit} listings with the
            latest &quot;Last updated&quot; (saved locally until you load again).
          </p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={runListingBatch}
            disabled={!canPost}
            title={
              !isAuthenticated
                ? 'Connect Alibaba in Settings first'
                : activeCount === 0
                  ? 'Load products or create a campaign first'
                  : `Post up to ${LISTING_BATCH_SIZE} new listings`
            }
          >
            {isPosting ? (
              <>
                <Loader2 size={18} className="spin" />
                Posting…
              </>
            ) : (
              <>
                <Play size={18} />
                Post listings
              </>
            )}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={runPagedSync}
            disabled={isBusy || !isAuthenticated}
            title={!isAuthenticated ? 'Connect Alibaba in Settings first' : undefined}
          >
            {isSyncing ? (
              <>
                <Loader2 size={18} className="spin" />
                Loading…
              </>
            ) : (
              <>
                <Download size={18} />
                Load from Alibaba
              </>
            )}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setView('form')}
            disabled={isBusy}
          >
            <Plus size={18} />
            New campaign
          </button>
        </div>
      </header>

      <div className="stat-grid">
        <div className="card">
          <div className="stat-card__top">
            <div className="icon-box icon-box--amber">
              <Zap size={22} />
            </div>
            <span className={`status-pill ${activeCount > 0 ? 'status-pill--active' : 'status-pill--idle'}`}>
              {activeCount > 0 ? 'Ready' : 'Empty'}
            </span>
          </div>
          <p className="stat-label">Products loaded</p>
          <p className="stat-value">{importedCount.toLocaleString()}</p>
          {alibabaTotal != null && (
            <p className="stat-meta">
              {alibabaTotal.toLocaleString()} on Alibaba · latest {syncProductLimit}
            </p>
          )}
        </div>

        <div className="card">
          <div className="stat-card__top">
            <div className="icon-box icon-box--green">
              <Play size={22} />
            </div>
          </div>
          <p className="stat-label">Eligible to post</p>
          <p className="stat-value">{activeCount}</p>
          <p className="stat-meta">
            Each run posts up to {LISTING_BATCH_SIZE} new listings (random products)
          </p>
        </div>
      </div>

      <div className="card card--flush">
        <div className="panel-tabs">
          <button
            type="button"
            className={`tab ${activeTab === 'dashboard' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Layers size={18} />
            Your products
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'queue' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <History size={18} />
            Listing history
          </button>

          {activeTab === 'dashboard' && campaigns.length > 0 && !isSyncing && (
            <div className="search-wrap">
              <Search size={16} />
              <input
                type="search"
                className="input-field search-input"
                placeholder="Search by name or ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search products"
              />
            </div>
          )}
        </div>

        <div className="panel-body">
          {batchMessage && (
            <div
              className={`alert ${batchMessage.type === 'success' ? 'alert--success' : 'alert--error'}`}
              role="status"
            >
              <span>{batchMessage.text}</span>
            </div>
          )}
          {syncError && (
            <div className="alert alert--error" role="alert">
              <span>{syncError}</span>
            </div>
          )}
          {isPosting && (
            <div className="alert" role="status">
              <Loader2 size={18} className="spin" style={{ flexShrink: 0 }} />
              <span>
                Posting up to {LISTING_BATCH_SIZE} listings (AI variations, ~5s between each). This
                can take several minutes — keep this tab open.
              </span>
            </div>
          )}

          {activeTab === 'dashboard' && isTableLoading ? (
            <div className="loading-state">
              <Loader2 size={36} className="spin" color="var(--primary)" />
              <p>Loading {syncProductLimit} products (sorted by last updated)…</p>
            </div>
          ) : activeTab === 'dashboard' && isLoading ? (
            <div className="loading-state">
              <Loader2 size={28} className="spin" color="var(--primary)" />
              <p>Loading saved products…</p>
            </div>
          ) : activeTab === 'dashboard' ? (
            campaigns.length === 0 ? (
              <div className="empty-state">
                <Coffee size={40} strokeWidth={1.5} color="var(--primary)" />
                {!isAuthenticated ? (
                  <>
                    <p style={{ marginTop: 16 }}>Connect your Alibaba account to load products.</p>
                    <Link href="/settings" className="btn-primary" style={{ marginTop: 16 }}>
                      Go to Settings
                    </Link>
                  </>
                ) : (
                  <>
                    <p style={{ marginTop: 16 }}>
                      No products loaded yet. Fetch the latest {syncProductLimit} from Alibaba.
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ marginTop: 16 }}
                      onClick={runPagedSync}
                      disabled={isSyncing}
                    >
                      <Download size={18} />
                      Load from Alibaba
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {filteredCampaigns.length > 0 && (
                  <p className="table-caption">
                    Showing {(tablePage - 1) * TABLE_PAGE_SIZE + 1}–
                    {Math.min(tablePage * TABLE_PAGE_SIZE, filteredCampaigns.length)} of{' '}
                    {filteredCampaigns.length.toLocaleString()}
                    {searchQuery ? ' matches' : ''}
                  </p>
                )}
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Last updated</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCampaigns.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="product-cell">
                            <div className="product-thumb">
                              {item.images?.[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.images[0]} alt="" />
                              ) : (
                                <Coffee size={18} color="var(--primary)" />
                              )}
                            </div>
                            <div>
                              <div className="product-name">{item.name}</div>
                              {item.template?.baseProductId && (
                                <div className="product-id">ID {item.template.baseProductId}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-muted">{formatAlibabaLastUpdated(item.gmtModified)}</td>
                        <td>
                          <span
                            className={`badge ${
                              item.alibabaStatus === 'approved' ? 'badge--success' : 'badge--neutral'
                            }`}
                          >
                            {formatAlibabaProductStatus(item.alibabaStatus)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalTablePages > 1 && (
                  <nav className="pagination" aria-label="Table pagination">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={tablePage <= 1}
                      onClick={() => setTablePage((p) => p - 1)}
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="pagination__info">
                      Page {tablePage} of {totalTablePages}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={tablePage >= totalTablePages}
                      onClick={() => setTablePage((p) => p + 1)}
                      aria-label="Next page"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </nav>
                )}
              </>
            )
          ) : historyCampaigns.length === 0 ? (
            <div className="empty-state">
              <History size={40} strokeWidth={1.5} color="var(--foreground-subtle)" />
              <p style={{ marginTop: 16 }}>
                No listing runs yet. Use <strong>Post listings</strong> on the dashboard to publish.
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Last run</th>
                </tr>
              </thead>
              <tbody>
                {historyCampaigns.map((item) => (
                  <tr key={item.id}>
                    <td className="product-name">{item.name}</td>
                    <td className="text-muted">{formatLastRun(item.lastRun)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
