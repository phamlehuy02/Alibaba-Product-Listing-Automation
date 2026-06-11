'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import {
  searchProductsForCompareAction,
  type ProductSearchOption,
} from '@/app/actions/listing-compare';

type Props = {
  label: string;
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
};

export default function ProductSearchPicker({
  label,
  value,
  onChange,
  placeholder = 'Search all Alibaba products by name or ID…',
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProductSearchOption[]>([]);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (searchQuery: string) => {
    setLoading(true);
    setError(null);
    const res = await searchProductsForCompareAction(searchQuery);
    setLoading(false);
    if (res.success === false) {
      setError(res.error);
      setResults([]);
      return;
    }
    setResults(res.products);
    setCatalogTotal(res.total);
  }, []);

  useEffect(() => {
    if (value && !query) {
      runSearch(value);
    } else if (!value && !query) {
      runSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const scheduleSearch = (nextQuery: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(nextQuery);
    }, 300);
  };

  const applyManualId = () => {
    const raw = query.trim().replace(/^.*\((\d+)\)\s*$/, '$1');
    if (/^\d{10,}$/.test(raw)) {
      onChange(raw);
      setOpen(false);
      runSearch(raw);
    }
  };

  const selected = results.find((p) => p.productId === value);

  return (
    <div className="product-picker" ref={wrapRef}>
      <label className="editor-label">{label}</label>
      <div className="product-picker__input-wrap">
        {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
        <input
          type="search"
          className="input-field product-picker__input"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            scheduleSearch(next);
          }}
          onFocus={() => {
            setOpen(true);
            if (results.length === 0) runSearch(query);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyManualId();
            }
          }}
        />
      </div>
      {value && (
        <p className="product-picker__selected">
          Selected ID <strong>{value}</strong>
          {selected?.name ? ` — ${selected.name.substring(0, 60)}` : ''}
        </p>
      )}
      {error && <p className="product-picker__error">{error}</p>}
      {open && (
        <ul className="product-picker__list" role="listbox">
          {loading && results.length === 0 ? (
            <li className="product-picker__empty">Searching Alibaba catalog…</li>
          ) : results.length === 0 ? (
            <li className="product-picker__empty">
              No matches. Press Enter to use a valid product ID directly.
            </li>
          ) : (
            results.map((p) => (
              <li key={p.productId}>
                <button
                  type="button"
                  className={`product-picker__option ${value === p.productId ? 'product-picker__option--active' : ''}`}
                  onClick={() => {
                    onChange(p.productId);
                    setQuery(`${p.name} (${p.productId})`);
                    setOpen(false);
                  }}
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="product-picker__thumb" />
                  ) : (
                    <span className="product-picker__thumb product-picker__thumb--empty" />
                  )}
                  <span className="product-picker__meta">
                    <span className="product-picker__name">{p.name}</span>
                    <span className="product-picker__id">
                      ID {p.productId}
                      {p.gmtModified ? ` · ${p.gmtModified.slice(0, 10)}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <p className="product-picker__hint">
        Live search via Alibaba product/list
        {catalogTotal != null ? ` (${catalogTotal.toLocaleString()} products on account)` : ''}.
        Type 2+ characters for title search, or a product ID.
      </p>
    </div>
  );
}
