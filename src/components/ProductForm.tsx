'use client';

import React, { useState } from 'react';
import { Sparkles, Save, Image as ImageIcon, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { optimizeProduct } from '@/lib/ai-optimizer';
import { saveCampaignAction } from '@/app/actions/campaigns';

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
  });

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
      await saveCampaignAction(data);
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
            <h3 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Media</h3>
            <div style={{ 
              border: '2px dashed var(--border)', 
              borderRadius: '12px', 
              padding: '32px', 
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              cursor: 'pointer'
            }}>
              <ImageIcon size={32} color="var(--primary)" style={{ marginBottom: '12px', opacity: 0.6 }} />
              <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Drag & drop images here or click to browse</p>
              <p style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '8px' }}>Min. 1000x1000px, white background recommended</p>
            </div>
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
    </div>
  );
}
