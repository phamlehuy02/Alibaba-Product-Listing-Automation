'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Shield, Key, RefreshCw, CheckCircle, AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import { exchangeTokenAction } from '@/app/actions/auth';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function SettingsContent() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Handle OAuth callback results from URL params
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

  const oauthUrl = `https://openapi-auth.alibaba.com/oauth/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_ALIBABA_APP_KEY || 'YOUR_APP_KEY'}&redirect_uri=${encodeURIComponent('https://example.com/callback')}`;

  return (
    <div className="animate-fade-in" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent-light)', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <h2 style={{ fontSize: '2.5rem', color: 'white' }}>API <span style={{ color: 'var(--primary)' }}>Authentication</span></h2>
        <p style={{ opacity: 0.6, marginTop: '8px' }}>Manage your Alibaba Open Platform credentials and tokens.</p>
      </div>

      {/* One-Click OAuth */}
      <div className="glass-card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(42, 157, 143, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <ExternalLink size={24} color="var(--success)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'white' }}>Quick Connect</h3>
            <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Connect once, and the system will keep you logged in automatically for months.</p>
          </div>
        </div>

        <a
          href={oauthUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}
        >
          <ExternalLink size={20} />
          Open Alibaba Authorization
        </a>

        <div style={{ marginTop: '20px' }}>
          <label htmlFor="redirect-url" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500, color: 'var(--accent-light)' }}>
            Paste the redirect URL here
          </label>
          <input
            id="redirect-url"
            type="text"
            value={code}
            onChange={(e) => {
              const val = e.target.value;
              // Auto-extract code from full URL like https://example.com/callback?code=3_502296_xxx
              const match = val.match(/[?&]code=([^&]+)/);
              setCode(match ? match[1] : val);
            }}
            placeholder="Paste the full URL from your browser address bar"
            className="input-field"
          />
          <p style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '8px' }}>After authorizing, copy the entire URL from the address bar and paste it above. You only need to do this <strong>once</strong>.</p>
        </div>

        <button
          onClick={async () => {
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
          }}
          disabled={loading || !code}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: '16px', opacity: loading || !code ? 0.6 : 1 }}
        >
          {loading ? <RefreshCw className="animate-spin" size={20} /> : <Key size={20} />}
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>

      {/* Manual code exchange (fallback) */}
      <div className="glass-card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(212, 163, 115, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <Shield size={24} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'white' }}>Manual Token Exchange</h3>
            <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Paste an authorization code if the automatic flow didn't work.</p>
          </div>
        </div>

        <form onSubmit={handleExchange}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="code" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500, color: 'var(--accent-light)' }}>
              Authorization Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste authorization code here"
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !code}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', opacity: loading || !code ? 0.6 : 1 }}
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Key size={20} />}
            {loading ? 'Exchanging...' : 'Exchange Code for Token'}
          </button>
        </form>
      </div>

      {error && (
        <div className="glass-card" style={{ background: 'rgba(231, 111, 81, 0.1)', border: '1px solid rgba(231, 111, 81, 0.2)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertCircle color="var(--error)" size={20} style={{ marginTop: '2px' }} />
            <div>
              <h4 style={{ color: 'var(--error)', fontWeight: 600 }}>Exchange Failed</h4>
              <p style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '4px' }}>{error}</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="glass-card" style={{ background: 'rgba(42, 157, 143, 0.1)', border: '1px solid rgba(42, 157, 143, 0.2)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
            <CheckCircle color="var(--success)" size={20} style={{ marginTop: '2px' }} />
            <div>
              <h4 style={{ color: 'var(--success)', fontWeight: 600 }}>Successfully Authenticated</h4>
              <p style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '4px' }}>
                {result.auto
                  ? 'Your account has been connected automatically. Tokens are saved.'
                  : 'Your tokens have been retrieved and saved successfully.'}
              </p>
            </div>
          </div>

          {!result.auto && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-light)', fontWeight: 700, marginBottom: '4px' }}>Access Token</p>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                  {result.access_token}
                </div>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-light)', fontWeight: 700, marginBottom: '4px' }}>Refresh Token</p>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                  {result.refresh_token}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-light)', fontWeight: 700, marginBottom: '4px' }}>Expires In</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>{result.expires_in}s</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-light)', fontWeight: 700, marginBottom: '4px' }}>Resource Owner</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>{result.resource_owner || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
          
          <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem', opacity: 0.7 }}>
            <p><strong>Note:</strong> Your tokens have been automatically saved. The automation engine will use them and refresh them when they expire. No manual action needed.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', color: 'white' }}>Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
