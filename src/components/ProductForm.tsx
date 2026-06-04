'use client';

import React, { useState } from 'react';
import { Sparkles, Save, Image as ImageIcon, ArrowLeft, CheckCircle2, Video, Trash2, Plus } from 'lucide-react';
import { optimizeProduct } from '@/lib/ai-optimizer';
import { saveCampaignAction } from '@/app/actions/campaigns';
import MediaBrowser from './MediaBrowser';

const CERTIFICATION_OPTIONS = ['ISO 22000', 'HACCP', 'Organic', 'Rainforest Alliance', 'UTZ', '4C Association', 'Fair Trade'];

interface ProductData {
  title: string;
  category: string;
  productType: string;
  roastLevel: string;
  beanVariety: string;
  origin: string;
  processing: string;
  description: string;
  price: string;
  moq: string;
  images: string[];
  videoId?: string;
  // Product Specifications
  certifications: string[];
  grade: string;
  packagingType: string;
  shelfLife: string;
  moisture: string;
  altitude: string;
  brandName: string;
  priceTiers: Array<{ minQty: number; price: number }>;
  customAttributes: Array<{ propName: string; valueName: string }>;
}

export default function ProductForm({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<ProductData>({
    title: '',
    category: '100009031', // Roasted Coffee Beans
    productType: 'roasted-beans',
    roastLevel: 'Medium',
    beanVariety: 'Arabica',
    origin: '',
    processing: 'Washed',
    description: '',
    price: '',
    moq: '100',
    images: [],
    certifications: [],
    grade: '',
    packagingType: 'Vacuum Bag',
    shelfLife: '24 months',
    moisture: '< 12.5%',
    altitude: '',
    brandName: 'Detech Coffee',
    priceTiers: [
      { minQty: 1, price: 13.00 }
    ],
    customAttributes: [
      { propName: 'Altitude', valueName: '1200-1800m above sea level' }
    ]
  });

  const toggleCertification = (cert: string) => {
    setData(prev => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter(c => c !== cert)
        : [...prev.certifications, cert],
    }));
  };

  const addPriceTier = () => {
    if (data.priceTiers.length >= 4) return;
    setData(prev => ({
      ...prev,
      priceTiers: [...prev.priceTiers, { minQty: 1, price: 0 }],
    }));
  };

  const updatePriceTier = (index: number, field: 'minQty' | 'price', value: number) => {
    setData(prev => {
      const updated = [...prev.priceTiers];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, priceTiers: updated };
    });
  };

  const removePriceTier = (index: number) => {
    setData(prev => ({
      ...prev,
      priceTiers: prev.priceTiers.filter((_, i) => i !== index),
    }));
  };

  const addCustomAttribute = () => {
    setData(prev => ({
      ...prev,
      customAttributes: [...prev.customAttributes, { propName: '', valueName: '' }],
    }));
  };

  const updateCustomAttribute = (index: number, field: 'propName' | 'valueName', value: string) => {
    setData(prev => {
      const updated = [...prev.customAttributes];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, customAttributes: updated };
    });
  };

  const removeCustomAttribute = (index: number) => {
    setData(prev => ({
      ...prev,
      customAttributes: prev.customAttributes.filter((_, i) => i !== index),
    }));
  };

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

  const hasValidPrice = data.price.trim() !== '' || (data.priceTiers.length > 0 && data.priceTiers.every(t => t.minQty > 0 && t.price > 0));
  const isFormValid = data.title.trim() !== '' && data.origin.trim() !== '' && hasValidPrice;

  const handleSave = async () => {
    if (!isFormValid) {
      alert('Please fill in at least the Title, Origin, and Price (or Price Tiers) fields.');
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
    <div className="page" style={{ maxWidth: 1000 }}>
      <button type="button" onClick={onBack} className="back-link">
        <ArrowLeft size={18} /> Back to dashboard
      </button>

      <header className="page-header">
        <div>
          <p className="eyebrow">New listing</p>
          <h2 className="page-title">
            List your <span className="highlight">coffee</span>
          </h2>
          <p className="page-description">Fill in the details to create a new automation campaign.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn-secondary" onClick={handleOptimize}>
            {isOptimizing ? (
              'Optimizing…'
            ) : (
              <>
                <Sparkles size={18} /> AI optimize
              </>
            )}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={isSaving || isDone || !isFormValid}
          >
            {isDone ? (
              <>
                <CheckCircle2 size={18} /> Campaign started
              </>
            ) : isSaving ? (
              'Saving…'
            ) : (
              <>
                <Save size={18} /> Save campaign
              </>
            )}
          </button>
        </div>
      </header>

      <div className="form-layout">
        <div className="card">
          <h3 className="form-section-title">Basic information</h3>
          
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
              <label>Product Type</label>
              <select 
                className="input-field" 
                value={data.productType || 'roasted-beans'} 
                onChange={(e) => {
                  const val = e.target.value;
                  let cat = '100009031';
                  if (val === 'green-beans') {
                    cat = '100009032';
                  } else if (val === 'drip-bag') {
                    cat = '100009033';
                  }
                  setData({
                    ...data,
                    productType: val,
                    category: cat,
                    roastLevel: val === 'green-beans' ? 'Not Applicable' : 'Medium'
                  });
                }}
              >
                <option value="green-beans">Green Coffee Beans</option>
                <option value="roasted-beans">Roasted Coffee Beans</option>
                <option value="ground-coffee">Ground Coffee</option>
                <option value="drip-bag">Drip Bag Coffee</option>
              </select>
            </div>
            <div>
              <label>Alibaba Category ID</label>
              <select className="input-field" value={data.category} onChange={(e) => setData({...data, category: e.target.value})}>
                <option value="100009032">Nhân xanh (Green coffee beans) - 100009032</option>
                <option value="100009033">Phin giấy (Drip bag coffee) - 100009033</option>
                <option value="100009031">Rang xay (Roasted / Ground coffee) - 100009031</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label>Roast Level</label>
              <select 
                className="input-field" 
                value={data.productType === 'green-beans' ? 'Not Applicable' : data.roastLevel} 
                onChange={(e) => setData({...data, roastLevel: e.target.value})}
                disabled={data.productType === 'green-beans'}
              >
                {data.productType === 'green-beans' ? (
                  <option value="Not Applicable">Not Applicable (Green Coffee)</option>
                ) : (
                  <>
                    <option>Light Roast</option>
                    <option>Medium Roast</option>
                    <option>Dark Roast</option>
                    <option>Italian Roast</option>
                  </>
                )}
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

        {/* ── Product Specifications Card ─────────────────────────── */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '1.2rem' }}>Product Specifications</h3>

          {/* Certifications */}
          <div style={{ marginBottom: '20px' }}>
            <label>Certifications</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
              {CERTIFICATION_OPTIONS.map(cert => {
                const selected = data.certifications.includes(cert);
                return (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => toggleCertification(cert)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: selected ? 'rgba(212, 163, 115, 0.15)' : 'var(--glass)',
                      color: selected ? 'var(--primary)' : 'rgba(255,255,255,0.6)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {selected ? '✓ ' : ''}{cert}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label>Grade</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Grade 1, A+, Specialty"
                value={data.grade}
                onChange={(e) => setData({ ...data, grade: e.target.value })}
              />
            </div>
            <div>
              <label>Packaging Type</label>
              <select className="input-field" value={data.packagingType} onChange={(e) => setData({ ...data, packagingType: e.target.value })}>
                <option>Vacuum Bag</option>
                <option>Jute Bag</option>
                <option>Paper Bag</option>
                <option>Custom OEM Bag</option>
                <option>GrainPro Bag</option>
                <option>Bulk (No Packaging)</option>
              </select>
            </div>
            <div>
              <label>Altitude (Growing Region)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 1200–1800m above sea level"
                value={data.altitude}
                onChange={(e) => setData({ ...data, altitude: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div>
              <label>Shelf Life</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 24 months"
                value={data.shelfLife}
                onChange={(e) => setData({ ...data, shelfLife: e.target.value })}
              />
            </div>
            <div>
              <label>Moisture Content</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. < 12.5%"
                value={data.moisture}
                onChange={(e) => setData({ ...data, moisture: e.target.value })}
              />
            </div>
            <div>
              <label>Brand Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Detech Coffee"
                value={data.brandName}
                onChange={(e) => setData({ ...data, brandName: e.target.value })}
              />
            </div>
          </div>

          {/* Custom Attributes */}
          <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Custom Attributes (Alibaba Properties)
              <button
                type="button"
                onClick={addCustomAttribute}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <Plus size={16} /> Add Attribute
              </button>
            </h4>
            <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '16px' }}>
              Add custom key-value attributes (e.g., Aroma, Cupping Score, Flavor Profile) that will be published under customMoreProperty in the Alibaba schema.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.customAttributes.map((attr, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Property Name (e.g. Flavor Profile)"
                      value={attr.propName}
                      onChange={(e) => updateCustomAttribute(idx, 'propName', e.target.value)}
                      style={{ margin: 0 }}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Property Value (e.g. Citrus, Caramel, Jasmine)"
                      value={attr.valueName}
                      onChange={(e) => updateCustomAttribute(idx, 'valueName', e.target.value)}
                      style={{ margin: 0 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomAttribute(idx)}
                    style={{
                      background: 'rgba(255, 0, 0, 0.1)',
                      border: '1px solid rgba(255, 0, 0, 0.2)',
                      borderRadius: '8px',
                      padding: '8px',
                      color: '#ff4d4d',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {data.customAttributes.length === 0 && (
                <p style={{ fontSize: '0.85rem', opacity: 0.4, fontStyle: 'italic', textAlign: 'center' }}>
                  No custom attributes added. Click "Add Attribute" above.
                </p>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div className="card">
            <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Pricing & MOQ
              <button
                type="button"
                onClick={addPriceTier}
                disabled={data.priceTiers.length >= 4}
                style={{
                  background: 'none',
                  border: 'none',
                  color: data.priceTiers.length >= 4 ? 'rgba(255,255,255,0.2)' : 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: data.priceTiers.length >= 4 ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <Plus size={16} /> Add Tier
              </button>
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label>Fallback Price Range (USD)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. 5.00 - 8.00" 
                value={data.price}
                onChange={(e) => setData({...data, price: e.target.value})}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label>Minimum Order Quantity (KG)</label>
              <input 
                type="number" 
                className="input-field" 
                value={data.moq}
                onChange={(e) => setData({...data, moq: e.target.value})}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Tiered Pricing (Optional)</label>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '12px' }}>
                Define quantity-based price tiers. If configured, these override the price range.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.priceTiers.map((tier, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="number"
                        className="input-field"
                        placeholder="Min Qty"
                        value={tier.minQty || ''}
                        onChange={(e) => updatePriceTier(idx, 'minQty', parseInt(e.target.value) || 0)}
                        style={{ margin: 0, fontSize: '0.85rem', padding: '8px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        placeholder="Price USD"
                        value={tier.price || ''}
                        onChange={(e) => updatePriceTier(idx, 'price', parseFloat(e.target.value) || 0)}
                        style={{ margin: 0, fontSize: '0.85rem', padding: '8px' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePriceTier(idx)}
                      style={{
                        background: 'rgba(255, 0, 0, 0.1)',
                        border: '1px solid rgba(255, 0, 0, 0.2)',
                        borderRadius: '6px',
                        padding: '6px',
                        color: '#ff4d4d',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {data.priceTiers.length === 0 && (
                  <p style={{ fontSize: '0.75rem', opacity: 0.4, fontStyle: 'italic', textAlign: 'center' }}>
                    No tiers defined. Using standard price range.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card">
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
                    background: 'var(--background)'
                  }}
                >
                  <Plus size={20} opacity={0.4} />
                </div>
              )}
            </div>

            {data.videoId ? (
              <div style={{ 
                padding: '12px', 
                background: 'var(--background)', 
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
                  color: 'var(--foreground-muted)',
                  fontSize: '0.9rem'
                }}
              >
                <Video size={18} /> Add Video
              </button>
            )}

            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%', marginTop: 16 }}
              onClick={() => setIsMediaBrowserOpen(true)}
            >
              Browse Alibaba Media Bank
            </button>
          </div>

          <div
            className="card"
            style={{
              background: isFormValid ? 'var(--success-soft)' : 'var(--background)',
              borderColor: isFormValid ? 'var(--success)' : 'var(--border)',
            }}
          >
            <div style={{ display: 'flex', gap: '12px' }}>
              <CheckCircle2 size={20} color={isFormValid ? 'var(--success)' : 'var(--foreground-subtle)'} />
              <div>
                <h4 style={{ color: isFormValid ? 'var(--success)' : 'var(--foreground-muted)', fontSize: '0.9rem' }}>
                  {isFormValid ? 'Ready to save' : 'Missing required fields'}
                </h4>
                <p className="field-hint" style={{ marginTop: 4 }}>
                  {isFormValid
                    ? 'All mandatory fields are filled.'
                    : 'Fill in title, origin, and price to enable saving.'}
                </p>
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
