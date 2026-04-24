'use client';

import React, { useState, useEffect } from 'react';
import { Coffee, Plus, Zap, Send, Layers, Settings, Calendar, Play, Pause, History } from 'lucide-react';
import ProductForm from '@/components/ProductForm';
import { getCampaignsAction, toggleCampaignAction } from '@/app/actions/campaigns';
import Link from 'next/link';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [view, setView] = useState<'dashboard' | 'form'>('dashboard');
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const data = await getCampaignsAction();
      setCampaigns(data);
    }
    load();
  }, [activeTab, view]);

  const handleToggle = async (id: string) => {
    await toggleCampaignAction(id);
    const data = await getCampaignsAction();
    setCampaigns(data);
  };

  if (view === 'form') {
    return <ProductForm onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="animate-fade-in" style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <p style={{ color: 'var(--accent-light)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '8px' }}>
            Exclusive Seller Tools
          </p>
          <h2 style={{ fontSize: '2.5rem', color: 'white' }}>Alibaba <span style={{ color: 'var(--primary)' }}>Bot Dashboard</span></h2>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/settings">
            <button className="btn-primary" style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}>
               <Settings size={18} /> Settings
            </button>
          </Link>
          <button className="btn-primary" style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}>
             <History size={18} /> View Logs
          </button>
          <button className="btn-primary" onClick={() => setView('form')}>
            <Plus size={20} />
            New Campaign
          </button>
        </div>
      </div>

      <div className="grid-layout" style={{ padding: 0, marginBottom: '40px' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(212, 163, 115, 0.1)', padding: '12px', borderRadius: '12px' }}>
              <Zap size={24} color="var(--primary)" />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Bot Active</span>
          </div>
          <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Automated Listings</p>
          <h3 style={{ fontSize: '2rem', color: 'white' }}>128 <span style={{ fontSize: '1rem', opacity: 0.5 }}>this month</span></h3>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(42, 157, 143, 0.1)', padding: '12px', borderRadius: '12px' }}>
              <Calendar size={24} color="var(--success)" />
            </div>
            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Next run: 9:00 AM</span>
          </div>
          <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Active Campaigns</p>
          <h3 style={{ fontSize: '2rem', color: 'white' }}>{campaigns.filter(c => c.active).length}</h3>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(188, 108, 37, 0.1)', padding: '12px', borderRadius: '12px' }}>
              <Send size={24} color="var(--accent)" />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>94% Success</span>
          </div>
          <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Total Publications</p>
          <h3 style={{ fontSize: '2rem', color: 'white' }}>1,432</h3>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '0' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '32px' }}>
          <button 
            onClick={() => setActiveTab('dashboard')}
            style={{ 
              background: 'none', border: 'none', color: activeTab === 'dashboard' ? 'var(--primary)' : 'white', 
              fontWeight: 600, cursor: 'pointer', opacity: activeTab === 'dashboard' ? 1 : 0.4,
              fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Layers size={18} /> Active Campaigns
          </button>
          <button 
            onClick={() => setActiveTab('queue')}
            style={{ 
              background: 'none', border: 'none', color: activeTab === 'queue' ? 'var(--primary)' : 'white', 
              fontWeight: 600, cursor: 'pointer', opacity: activeTab === 'queue' ? 1 : 0.4,
              fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <History size={18} /> Recent History
          </button>
        </div>
        
        <div style={{ padding: '24px' }}>
          {activeTab === 'dashboard' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '16px 0', fontWeight: 500, color: 'var(--accent-light)' }}>Campaign Name</th>
                  <th style={{ padding: '16px 0', fontWeight: 500, color: 'var(--accent-light)' }}>Last Run</th>
                  <th style={{ padding: '16px 0', fontWeight: 500, color: 'var(--accent-light)' }}>Status</th>
                  <th style={{ padding: '16px 0', fontWeight: 500, color: 'var(--accent-light)' }}>Automation</th>
                  <th style={{ padding: '16px 0', fontWeight: 500, color: 'var(--accent-light)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '20px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', background: 'var(--glass)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Coffee size={18} color="var(--primary)" />
                        </div>
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '20px 0', opacity: 0.7 }}>{item.lastRun}</td>
                    <td style={{ padding: '20px 0' }}>
                      <span style={{ 
                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem',
                        background: item.active ? 'rgba(42, 157, 143, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        color: item.active ? 'var(--success)' : 'white'
                      }}>
                        {item.active ? 'Running' : 'Paused'}
                      </span>
                    </td>
                    <td style={{ padding: '20px 0' }}>
                      <button 
                        onClick={() => handleToggle(item.id)}
                        style={{ 
                          background: 'var(--glass)', border: '1px solid var(--border)', 
                          padding: '6px 12px', borderRadius: '8px', color: 'white', 
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' 
                        }}
                      >
                        {item.active ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
                      </button>
                    </td>
                    <td style={{ padding: '20px 0' }}>
                      <button style={{ background: 'none', border: 'none', color: 'white', opacity: 0.5, cursor: 'pointer' }}>
                        <Settings size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
              <History size={48} style={{ marginBottom: '16px' }} />
              <p>No recent activity logs found. Start a campaign to see results here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
