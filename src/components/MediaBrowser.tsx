'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Image as ImageIcon, Video, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getPhotobankImagesAction, getVideosAction } from '@/app/actions/media';

interface MediaBrowserProps {
  onClose: () => void;
  onSelect: (images: string[], videoId?: string) => void;
  initialImages?: string[];
  initialVideoId?: string;
}

export default function MediaBrowser({ onClose, onSelect, initialImages = [], initialVideoId }: MediaBrowserProps) {
  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [images, setImages] = useState<any[]>([]);
  const [imagePage, setImagePage] = useState(1);
  const [totalImages, setTotalImages] = useState(0);
  
  const [videos, setVideos] = useState<any[]>([]);
  const [videoPage, setVideoPage] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [videoSearch, setVideoSearch] = useState('');

  const [selectedImages, setSelectedImages] = useState<string[]>(initialImages);
  const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(initialVideoId);

  const fetchImages = async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPhotobankImagesAction(page, 15);
      if (result.success) {
        // Alibaba API response structure can vary, but usually looks like this:
        const data = result.data.alibaba_icbu_photobank_list_response?.photo_list?.photo || [];
        setImages(data);
        // setTotalImages(result.data.total_count || 0);
      } else {
        setError(result.error || 'Failed to load images');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVideos = async (page: number, search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getVideosAction(page, 10, search);
      if (result.success) {
        const data = result.data.alibaba_icbu_video_query_response?.video_list?.isv_video_dto || [];
        setVideos(data);
      } else {
        setError(result.error || 'Failed to load videos');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'images') {
      fetchImages(imagePage);
    } else {
      fetchVideos(videoPage, videoSearch);
    }
  }, [activeTab, imagePage, videoPage]);

  const toggleImage = (url: string) => {
    if (selectedImages.includes(url)) {
      setSelectedImages(selectedImages.filter(i => i !== url));
    } else {
      if (selectedImages.length < 9) {
        setSelectedImages([...selectedImages, url]);
      }
    }
  };

  const selectVideo = (id: string) => {
    setSelectedVideoId(id === selectedVideoId ? undefined : id);
  };

  const handleConfirm = () => {
    onSelect(selectedImages, selectedVideoId);
    onClose();
  };

  return (
    <div className="media-browser-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '1000px',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        border: '1px solid var(--border)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 30px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Alibaba Media Bank</h3>
            <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Select assets already in your Alibaba account</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs & Search */}
        <div style={{
          padding: '15px 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('images')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'images' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: activeTab === 'images' ? 'black' : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              <ImageIcon size={18} /> Images ({selectedImages.length}/9)
            </button>
            <button 
              onClick={() => setActiveTab('videos')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'videos' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: activeTab === 'videos' ? 'black' : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              <Video size={18} /> Video {selectedVideoId ? '(1 Selected)' : ''}
            </button>
          </div>

          {activeTab === 'videos' && (
            <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
              <input 
                type="text" 
                className="input-field"
                placeholder="Search videos..."
                style={{ paddingLeft: '36px', height: '38px', margin: 0 }}
                value={videoSearch}
                onChange={(e) => setVideoSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchVideos(1, videoSearch)}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 30px 30px', minHeight: 0 }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <Loader2 size={40} className="animate-spin" style={{ marginBottom: '16px' }} />
              <p>Fetching your assets from Alibaba...</p>
            </div>
          ) : error ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ff4d4d' }}>
              <p style={{ marginBottom: '16px' }}>{error}</p>
              <button className="btn-primary" onClick={() => activeTab === 'images' ? fetchImages(imagePage) : fetchVideos(videoPage)}>Retry</button>
            </div>
          ) : activeTab === 'images' ? (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
              gap: '16px' 
            }}>
              {images.map((img, i) => (
                <div 
                  key={i} 
                  onClick={() => toggleImage(img.url)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'pointer',
                    border: selectedImages.includes(img.url) ? '3px solid var(--primary)' : '1px solid var(--border)',
                    transition: 'transform 0.2s'
                  }}
                  className="image-card"
                >
                  <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {selectedImages.includes(img.url) && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'var(--primary)',
                      color: 'black',
                      borderRadius: '50%',
                      padding: '2px'
                    }}>
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.5)',
                    fontSize: '0.6rem',
                    opacity: 0.8
                  }}>
                    {img.file_name?.slice(0, 20)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {videos.map((vid, i) => (
                <div 
                  key={i} 
                  onClick={() => selectVideo(vid.video_id)}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '12px',
                    borderRadius: '12px',
                    background: selectedVideoId === vid.video_id ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(255,255,255,0.02)',
                    border: selectedVideoId === vid.video_id ? '1px solid var(--primary)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: '120px', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                    <img src={vid.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '4px' }}>
                      <Video size={16} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{vid.title}</h4>
                    <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>ID: {vid.video_id}</p>
                    <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>Duration: {vid.duration}s</p>
                  </div>
                  {selectedVideoId === vid.video_id && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ background: 'var(--primary)', color: 'black', borderRadius: '50%', padding: '4px' }}>
                        <Check size={18} strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 30px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              disabled={activeTab === 'images' ? imagePage === 1 : videoPage === 1}
              onClick={() => activeTab === 'images' ? setImagePage(p => p - 1) : setVideoPage(p => p - 1)}
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', opacity: 0.6 }}>
              Page {activeTab === 'images' ? imagePage : videoPage}
            </span>
            <button 
              onClick={() => activeTab === 'images' ? setImagePage(p => p + 1) : setVideoPage(p => p + 1)}
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-primary" style={{ background: 'none', border: '1px solid var(--border)', color: 'white' }} onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleConfirm}>Select Media</button>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .image-card:hover {
          transform: scale(1.05);
          border-color: var(--primary);
        }
      `}</style>
    </div>
  );
}
