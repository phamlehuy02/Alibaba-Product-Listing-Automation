'use client';

import React, { useState } from 'react';
import { Sparkles, Save, Image as ImageIcon, ArrowLeft, CheckCircle2, Video, Trash2, Plus } from 'lucide-react';
import { optimizeProduct } from '@/lib/ai-optimizer';
import { saveCampaignAction } from '@/app/actions/campaigns';
import MediaBrowser from './MediaBrowser';

interface ProductData {
  title: string;
  category: string;
  roastLevel: string;
  beanVariety: string;
  origin: string;
  processing: string;
  description: string;
  price: string;
  moq: string;
  images: string[];
  videoId?: string;
}

export default function ProductForm({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<ProductData>({
    title: '',
    category: '100009031', // Roasted Coffee Beans
    roastLevel: 'Medium',
    beanVariety: 'Arabica',
    origin: '',
    processing: 'Washed',
    description: '',
    price: '',
    moq: '100',
    images: [],
  });

  const [isMediaBrowserOpen, setIsMediaBrowserOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const result = await optimizeProduct(data);
      setData({
        ...data,
        title: result.title,
        description: result.description
      });
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const isFormValid = data.title.trim() !== '' && data.origin.trim() !== '' && data.price.trim() !== '';

  const handleSave = async () => {
    if (!isFormValid) {
      alert('Please fill in at least the Title, Origin, and Price fields.');
      return;
    }
    setIsSaving(true);
    try {
      await saveCampaignAction({
        ...data,
        images: data.images,
        videoId: data.videoId
      });
      setIsDone(true);
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save campaign. Check the console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px' }}>
      <button 
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}
      >
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', color: 'white' }}>List Your <span style={{ color: 'var(--primary)' }}>Coffee</span></h2>
          <p style={{ opacity: 0.6 }}>Fill in the details to publish your product to Alibaba.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn-primary" 
            style={{ background: 'var(--glass)', border: '1px solid var(--border)', color: 'white' }}
            onClick={handleOptimize}
          >
            {isOptimizing ? 'Optimizing...' : <><Sparkles size={18} color="var(--primary)" /> AI Optimize</>}
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving || isDone || !isFormValid} style={!isFormValid && !isDone ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
            {isDone ? <><CheckCircle2 size={18} /> Campaign Started!</> : isSaving ? 'Saving...' : <><Save size={18} /> Save & Start Automation</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <div className="glass-card">
          <h3 style={{ marginBottom: '24px', fontSize: '1.2rem' }}>Basic Information</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <label>Product Subject / Title</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Premium Highland Arabica Coffee Beans - Medium Roast"
              value={data.title}
              onChange={(e) => setData({...data, title: e.target.value})}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label>Product Category</label>
            <select className="input-field" value={data.category} onChange={(e) => setData({...data, category: e.target.value})}>
              <option value="100009032">Nhân xanh (Green coffee beans)</option>
              <option value="100009033">Phin giấy (Drip bag coffee)</option>
              <option value="100009031">Rang xay (Roasted coffee beans / Ground coffee)</option>
            </select>
            <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '4px' }}>Note: The exact Alibaba Category ID mapping may need to be updated in the system settings.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label>Roast Level</label>
              <select className="input-field" value={data.roastLevel} onChange={(e) => setData({...data, roastLevel: e.target.value})}>
                <option>Light Roast</option>
                <option>Medium Roast</option>
                <option>Dark Roast</option>
                <option>Italian Roast</option>
              </select>
            </div>
            <div>
              <label>Bean Variety</label>
              <select className="input-field" value={data.beanVariety} onChange={(e) => setData({...data, beanVariety: e.target.value})}>
                <option>Arabica</option>
                <option>Robusta</option>
                <option>Liberica</option>
                <option>Excelsa</option>
                <option>Blend</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label>Origin Country / Region</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. Vietnam, Brazil, Ethiopia" 
                value={data.origin}
                onChange={(e) => setData({...data, origin: e.target.value})}
              />
            </div>
            <div>
              <label>Processing Method</label>
              <select className="input-field" value={data.processing} onChange={(e) => setData({...data, processing: e.target.value})}>
                <option>Washed (Wet)</option>
                <option>Natural (Dry)</option>
                <option>Honey Processed</option>
                <option>Giling Basah</option>
              </select>
            </div>
          </div>

          <div>
            <label>Detailed Description</label>
            <textarea 
              className="input-field" 
              rows={8} 
              placeholder="Describe your coffee beans, flavor profiles, aroma, acidity..."
              value={data.description}
              onChange={(e) => setData({...data, description: e.target.value})}
              style={{ resize: 'vertical' }}
            ></textarea>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div className="glass-card">
            <h3 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Pricing & MOQ</h3>
            <div style={{ marginBottom: '16px' }}>
              <label>Price Range (USD)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. 5.00 - 8.00" 
                value={data.price}
                onChange={(e) => setData({...data, price: e.target.value})}
              />
            </div>
            <div>
              <label>Minimum Order Quantity (KG)</label>
              <input 
                type="number" 
                className="input-field" 
                value={data.moq}
                onChange={(e) => setData({...data, moq: e.target.value})}
              />
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Media 
              <span style={{ fontSize: '0.8rem', opacity: 0.5, fontWeight: 'normal' }}>{data.images.length}/9 Images</span>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              {data.images.map((img, i) => (
                <div key={i} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', position: 'relative', border: '1px solid var(--border)' }}>
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button 
                    onClick={() => setData({ ...data, images: data.images.filter((_, idx) => idx !== i) })}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,0,0,0.7)', border: 'none', borderRadius: '4px', padding: '4px', color: 'white', cursor: 'pointer' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {data.images.length < 9 && (
                <div 
                  onClick={() => setIsMediaBrowserOpen(true)}
                  style={{ 
                    aspectRatio: '1', 
                    borderRadius: '8px', 
                    border: '1px dashed var(--border)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                >
                  <Plus size={20} opacity={0.4} />
                </div>
              )}
            </div>

            {data.videoId ? (
              <div style={{ 
                padding: '12px', 
                background: 'rgba(255,255,255,0.05)', 
                borderRadius: '8px', 
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Video size={18} color="var(--primary)" />
                <div style={{ flex: 1, fontSize: '0.8rem' }}>
                  <p>Video Selected</p>
                  <p style={{ opacity: 0.4, fontSize: '0.7rem' }}>ID: {data.videoId}</p>
                </div>
                <button 
                  onClick={() => setData({ ...data, videoId: undefined })}
                  style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsMediaBrowserOpen(true)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px dashed var(--border)', 
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.9rem'
                }}
              >
                <Video size={18} /> Add Video
              </button>
            )}

            <button 
              onClick={() => setIsMediaBrowserOpen(true)}
              style={{ 
                width: '100%', 
                marginTop: '16px',
                padding: '10px', 
                background: 'var(--glass)', 
                border: '1px solid var(--border)', 
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Browse Alibaba Media Bank
            </button>
          </div>

          <div className="glass-card" style={{ background: isFormValid ? 'rgba(42, 157, 143, 0.05)' : 'rgba(255, 255, 255, 0.02)', borderColor: isFormValid ? 'var(--success)' : 'var(--border)' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <CheckCircle2 size={20} color={isFormValid ? 'var(--success)' : 'rgba(255,255,255,0.3)'} />
              <div>
                <h4 style={{ color: isFormValid ? 'var(--success)' : 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>{isFormValid ? 'Ready for Sync' : 'Missing Required Fields'}</h4>
                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>{isFormValid ? 'All mandatory fields are filled. Ready to publish.' : 'Fill in Title, Origin, and Price to enable saving.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isMediaBrowserOpen && (
        <MediaBrowser 
          onClose={() => setIsMediaBrowserOpen(false)}
          onSelect={(images, videoId) => setData({ ...data, images, videoId })}
          initialImages={data.images}
          initialVideoId={data.videoId}
        />
      )}
    </div>
  );
}
