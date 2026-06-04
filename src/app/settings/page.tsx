'use client';

import React, { useState, useEffect, Suspense } from 'react';
import {
  Shield,
  Key,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { exchangeTokenAction } from '@/app/actions/auth';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function SettingsContent() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get('success');
    const callbackError = searchParams.get('error');

    if (success === 'true') {
      setResult({ auto: true });
    } else if (callbackError) {
      setError(`OAuth failed: ${callbackError}`);
    }
  }, [searchParams]);

  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await exchangeTokenAction(code);
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.error || 'Failed to exchange token');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const connectWithCode = async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await exchangeTokenAction(code);
      if (res.success) setResult(res.data);
      else setError(res.error || 'Failed to exchange token');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const oauthUrl = `https://openapi-auth.alibaba.com/oauth/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_ALIBABA_APP_KEY || 'YOUR_APP_KEY'}&redirect_uri=${encodeURIComponent('https://example.com/callback')}`;

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <Link href="/" className="back-link">
        <ArrowLeft size={16} />
        Back to dashboard
      </Link>

      <header className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h2 className="page-title">
            Alibaba <span className="highlight">connection</span>
          </h2>
          <p className="page-description">
            Connect once via OAuth. Tokens are saved locally for product sync and automation.
          </p>
        </div>
      </header>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
          <div className="icon-box icon-box--green">
            <ExternalLink size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.0625rem', marginBottom: 6 }}>Quick connect</h3>
            <p className="field-hint">
              Authorize in Alibaba, then paste the redirect URL below. You only need to do this once.
            </p>
          </div>
        </div>

        <a
          href={oauthUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ width: '100%' }}
        >
          <ExternalLink size={18} />
          Open Alibaba authorization
        </a>

        <div style={{ marginTop: 20 }}>
          <label htmlFor="redirect-url" className="field-label">
            Redirect URL
          </label>
          <input
            id="redirect-url"
            type="text"
            value={code}
            onChange={(e) => {
              const val = e.target.value;
              const match = val.match(/[?&]code=([^&]+)/);
              setCode(match ? match[1] : val);
            }}
            placeholder="Paste the full URL from your browser address bar"
            className="input-field"
          />
          <p className="field-hint">
            After authorizing, copy the entire URL from the address bar and paste it here.
          </p>
        </div>

        <button
          type="button"
          onClick={connectWithCode}
          disabled={loading || !code}
          className="btn-primary"
          style={{ width: '100%', marginTop: 16 }}
        >
          {loading ? <RefreshCw className="spin" size={18} /> : <Key size={18} />}
          {loading ? 'Connecting…' : 'Connect'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
          <div className="icon-box icon-box--amber">
            <Shield size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.0625rem', marginBottom: 6 }}>Manual token exchange</h3>
            <p className="field-hint">Paste an authorization code if the redirect flow did not work.</p>
          </div>
        </div>

        <form onSubmit={handleExchange}>
          <label htmlFor="code" className="field-label">
            Authorization code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste authorization code"
            className="input-field"
          />
          <button
            type="submit"
            disabled={loading || !code}
            className="btn-secondary"
            style={{ width: '100%', marginTop: 16 }}
          >
            {loading ? <RefreshCw className="spin" size={18} /> : <Key size={18} />}
            {loading ? 'Exchanging…' : 'Exchange code for token'}
          </button>
        </form>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <p className="alert__title">Connection failed</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="alert alert--success">
          <CheckCircle size={20} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p className="alert__title">Successfully connected</p>
            <p className="field-hint" style={{ marginTop: 4 }}>
              {result.auto
                ? 'Your account is connected. Tokens are saved automatically.'
                : 'Tokens were saved successfully.'}
            </p>

            {!result.auto && (
              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <div>
                  <p className="field-label">Access token</p>
                  <div className="code-block">{result.access_token}</div>
                </div>
                <div>
                  <p className="field-label">Refresh token</p>
                  <div className="code-block">{result.refresh_token}</div>
                </div>
              </div>
            )}

            <p className="note-box">
              Tokens are stored locally. Return to the dashboard to load your latest products.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="page loading-state">
          <Loader2 className="spin" size={28} />
          <p>Loading settings…</p>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
