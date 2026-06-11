'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Loader2, Search } from 'lucide-react';
import ProductSearchPicker from '@/components/ProductSearchPicker';
import {
  compareListingsByProductIdAction,
  type ListingCompareResult,
} from '@/app/actions/listing-compare';
import type { ListingComparisonRow } from '@/lib/listing-v2-compare';

type Props = {
  initialLeftId?: string;
  initialRightId?: string;
};

export default function ListingCompareView({ initialLeftId = '', initialRightId = '' }: Props) {
  const [leftId, setLeftId] = useState(initialLeftId);
  const [rightId, setRightId] = useState(initialRightId);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ListingCompareResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'diff'>('diff');
  const [fieldSearch, setFieldSearch] = useState('');

  const runCompare = useCallback(async () => {
    setComparing(true);
    setError(null);
    setResult(null);
    const res = await compareListingsByProductIdAction(leftId, rightId);
    setComparing(false);
    if (res.success === false) {
      setError(res.error);
      return;
    }
    setResult(res.result);
  }, [leftId, rightId]);

  useEffect(() => {
    if (initialLeftId && initialRightId) {
      runCompare();
    }
  }, [initialLeftId, initialRightId, runCompare]);

  const displayRows = useMemo(() => {
    if (!result) return [];
    let rows: ListingComparisonRow[] = result.rows;
    if (filter === 'diff') {
      rows = rows.filter((r) => r.status !== 'same');
    }
    const q = fieldSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.path.toLowerCase().includes(q) ||
          r.label.toLowerCase().includes(q) ||
          r.left.toLowerCase().includes(q) ||
          r.right.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [result, filter, fieldSearch]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Listing compare</p>
          <h2 className="page-title">Compare two product listings</h2>
          <p className="page-description">
            Search your full Alibaba catalog (live API) by product name or ID — not limited to
            products loaded on the dashboard.
          </p>
        </div>
      </header>

      <div className="compare-form">
        <ProductSearchPicker label="Listing A" value={leftId} onChange={setLeftId} />
        <div className="compare-form__divider" aria-hidden>
          <ArrowLeftRight size={20} />
        </div>
        <ProductSearchPicker label="Listing B" value={rightId} onChange={setRightId} />
        <button
          type="button"
          className="btn-primary compare-form__submit"
          disabled={comparing || !leftId || !rightId}
          onClick={runCompare}
        >
          {comparing ? <Loader2 size={18} className="spin" /> : <ArrowLeftRight size={18} />}
          Compare
        </button>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="compare-summary">
            <SummaryCard
              title={`A · ${result.summary.leftProductId}`}
              lines={[
                result.summary.leftSubject,
                `Description: ${result.summary.leftDescriptionChars.toLocaleString()} chars`,
                `Images: ${result.summary.leftImageCount}`,
              ]}
            />
            <SummaryCard
              title={`B · ${result.summary.rightProductId}`}
              lines={[
                result.summary.rightSubject,
                `Description: ${result.summary.rightDescriptionChars.toLocaleString()} chars`,
                `Images: ${result.summary.rightImageCount}`,
              ]}
            />
            <div className="compare-summary__stats">
              <strong>{result.differenceCount}</strong>
              <span>schema field differences</span>
              <span className="compare-summary__total">
                of {result.rows.length} compared fields
              </span>
            </div>
          </div>

          <div className="compare-toolbar">
            <div className="compare-filter">
              <button
                type="button"
                className={`editor-tab ${filter === 'diff' ? 'editor-tab--active' : ''}`}
                onClick={() => setFilter('diff')}
              >
                Differences only ({result.differenceCount})
              </button>
              <button
                type="button"
                className={`editor-tab ${filter === 'all' ? 'editor-tab--active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All fields ({result.rows.length})
              </button>
            </div>
            <div className="search-wrap compare-search">
              <Search size={16} />
              <input
                type="search"
                className="input-field search-input"
                placeholder="Filter compared fields…"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="compare-table-wrap">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Listing A</th>
                  <th>Listing B</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={row.path} className={`compare-row compare-row--${row.status}`}>
                    <td>
                      <code className="editor-field__id">{row.path}</code>
                      <div className="compare-field-name">{row.label}</div>
                    </td>
                    <td className="compare-cell">{truncate(row.left)}</td>
                    <td className="compare-cell">{truncate(row.right)}</td>
                    <td>
                      <span className={`compare-badge compare-badge--${row.status}`}>
                        {row.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayRows.length === 0 && (
              <p className="compare-empty">
                {filter === 'diff'
                  ? 'No schema field differences — listings match on compared fields.'
                  : 'No fields match your filter.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="compare-summary__card">
      <h3>{title}</h3>
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

function truncate(value: string, max = 200): string {
  if (!value) return '—';
  const oneLine = value.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
