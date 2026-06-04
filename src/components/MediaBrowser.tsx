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
        const data = result.data.alibaba_icbu_photobank_list_response?.photo_list?.photo || 
                     result.data.result?.photo_list?.photo || 
                     result.data.result?.pagination_query_list?.list || [];
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Media browser">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.0625rem', marginBottom: 4 }}>Alibaba Media Bank</h3>
            <p className="field-hint">Select assets from your Alibaba account</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <div className="media-tabs" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`media-tab ${activeTab === 'images' ? 'media-tab--active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              <ImageIcon size={18} /> Images ({selectedImages.length}/9)
            </button>
            <button
              type="button"
              className={`media-tab ${activeTab === 'videos' ? 'media-tab--active' : ''}`}
              onClick={() => setActiveTab('videos')}
            >
              <Video size={18} /> Video{selectedVideoId ? ' (1 selected)' : ''}
            </button>
          </div>
          {activeTab === 'videos' && (
            <div className="search-wrap" style={{ marginLeft: 0, maxWidth: 280 }}>
              <Search size={16} />
              <input
                type="search"
                className="input-field search-input"
                placeholder="Search videos…"
                value={videoSearch}
                onChange={(e) => setVideoSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchVideos(1, videoSearch)}
              />
            </div>
          )}
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <Loader2 size={32} className="spin" color="var(--primary)" />
              <p>Loading assets from Alibaba…</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <p className="alert__title" style={{ color: 'var(--error)' }}>
                {error}
              </p>
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 16 }}
                onClick={() =>
                  activeTab === 'images' ? fetchImages(imagePage) : fetchVideos(videoPage)
                }
              >
                Retry
              </button>
            </div>
          ) : activeTab === 'images' ? (
            <div className="media-grid">
              {images.map((img, i) => (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleImage(img.url)}
                  onKeyDown={(e) => e.key === 'Enter' && toggleImage(img.url)}
                  className={`media-thumb ${selectedImages.includes(img.url) ? 'media-thumb--selected' : ''}`}
                >
                  <img src={img.url} alt="" />
                  {selectedImages.includes(img.url) && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'var(--primary)',
                        color: '#fff',
                        borderRadius: '50%',
                        padding: 2,
                      }}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {videos.map((vid, i) => (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectVideo(vid.video_id)}
                  onKeyDown={(e) => e.key === 'Enter' && selectVideo(vid.video_id)}
                  className="card"
                  style={{
                    padding: 12,
                    cursor: 'pointer',
                    borderColor:
                      selectedVideoId === vid.video_id ? 'var(--primary)' : 'var(--border)',
                    background:
                      selectedVideoId === vid.video_id ? 'var(--primary-soft)' : 'var(--card-bg)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 120,
                        aspectRatio: '16/9',
                        borderRadius: 8,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={vid.cover_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: 4 }}>{vid.title}</h4>
                      <p className="field-hint">ID: {vid.video_id}</p>
                    </div>
                    {selectedVideoId === vid.video_id && (
                      <Check size={20} color="var(--primary)" strokeWidth={2.5} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="pagination" style={{ margin: 0 }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={activeTab === 'images' ? imagePage === 1 : videoPage === 1}
              onClick={() =>
                activeTab === 'images' ? setImagePage((p) => p - 1) : setVideoPage((p) => p - 1)
              }
            >
              <ChevronLeft size={18} />
            </button>
            <span className="pagination__info">
              Page {activeTab === 'images' ? imagePage : videoPage}
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                activeTab === 'images' ? setImagePage((p) => p + 1) : setVideoPage((p) => p + 1)
              }
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleConfirm}>
              Select media
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
