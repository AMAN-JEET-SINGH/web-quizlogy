'use client';

import { useState, useEffect } from 'react';
import { uploadApi } from '@/lib/api';
import type { GalleryImage } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import './ImageGallery.css';

interface ImageGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imagePath: string) => void;
  filterType?: 'categories' | 'contests' | 'funfacts' | 'battles' | 'all';
}

export default function ImageGallery({ isOpen, onClose, onSelect, filterType = 'all' }: ImageGalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>(filterType === 'all' ? 'all' : filterType);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedType]);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await uploadApi.getGallery();
      console.log('Gallery API response:', response);
      let filteredImages = response.images;
      
      // Filter by type if not 'all'
      if (selectedType !== 'all') {
        filteredImages = filteredImages.filter(img => img.type === selectedType);
      }
      
      console.log('Filtered images:', filteredImages);
      setImages(filteredImages);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load gallery';
      setError(errorMsg);
      console.error('Gallery fetch error:', err);
      console.error('Error details:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (imagePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    setDeletingPath(imagePath);
    try {
      await uploadApi.deleteImage(imagePath);
      // Remove from local state
      setImages(images.filter(img => img.path !== imagePath));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete image');
      console.error('Delete error:', err);
    } finally {
      setDeletingPath(null);
    }
  };

  const handleSelect = (imagePath: string) => {
    console.log('Image selected:', imagePath);
    onSelect(imagePath);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="gallery-overlay" onClick={onClose}>
      <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gallery-header">
          <h2>Image Gallery</h2>
          <button className="gallery-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="gallery-filters">
          <label>Filter by type:</label>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="gallery-type-filter"
          >
            <option value="all">All Images</option>
            <option value="categories">Categories</option>
            <option value="contests">Contests</option>
            <option value="funfacts">Fun Facts</option>
            <option value="battles">Battles</option>
          </select>
        </div>

        {error && <div className="gallery-error">{error}</div>}

        {loading ? (
          <div className="gallery-loading">Loading images...</div>
        ) : images.length === 0 ? (
          <div className="gallery-empty">No images found</div>
        ) : (
          <>
            <div className="gallery-grid-container">
              <div className="gallery-grid">
                {images.map((image) => (
                  <div 
                    key={image.path} 
                    className="gallery-item"
                  >
                    <div className="gallery-item-image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt={image.filename}
                        onError={(e) => {
                          console.error('Image failed to load:', image.url);
                          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                          const fallbackUrl = image.path.startsWith('uploads/') 
                            ? `${apiUrl}/${image.path}`
                            : `${apiUrl}/uploads/${image.type}/${image.filename}`;
                          (e.target as HTMLImageElement).src = fallbackUrl;
                        }}
                      />
                      <div className="gallery-item-overlay">
                        <button
                          className="gallery-select-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(image.path);
                          }}
                        >
                          ✓ Select
                        </button>
                        <button
                          className="gallery-preview-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(previewImage?.path === image.path ? null : image);
                          }}
                        >
                          👁️ {previewImage?.path === image.path ? 'Hide Preview' : 'Preview'}
                        </button>
                        <button
                          className="gallery-delete-btn"
                          onClick={(e) => handleDelete(image.path, e)}
                          disabled={deletingPath === image.path}
                        >
                          {deletingPath === image.path ? '⏳ Deleting...' : '🗑️ Delete'}
                        </button>
                      </div>
                    </div>
                    <div className="gallery-item-info">
                      <div className="gallery-item-filename" title={image.filename}>
                        {image.filename}
                      </div>
                      <div className="gallery-item-meta">
                        <span className={`gallery-item-type type-${image.type}`}>{image.type}</span>
                        <span className="gallery-item-size">
                          {(image.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Preview Panel */}
            {previewImage && (
              <div className="gallery-preview-panel">
                <div className="preview-panel-header">
                  <h3>Preview</h3>
                  <button 
                    className="preview-panel-close"
                    onClick={() => setPreviewImage(null)}
                  >
                    ×
                  </button>
                </div>
                <div className="preview-panel-content">
                  <div className="preview-large-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImage.url}
                      alt={previewImage.filename}
                      onError={(e) => {
                        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                        const fallbackUrl = previewImage.path.startsWith('uploads/') 
                          ? `${apiUrl}/${previewImage.path}`
                          : `${apiUrl}/uploads/${previewImage.type}/${previewImage.filename}`;
                        (e.target as HTMLImageElement).src = fallbackUrl;
                      }}
                    />
                  </div>
                  <div className="preview-panel-info">
                    <div className="preview-info-row">
                      <strong>Filename:</strong> {previewImage.filename}
                    </div>
                    <div className="preview-info-row">
                      <strong>Type:</strong> <span className={`type-badge type-${previewImage.type}`}>{previewImage.type}</span>
                    </div>
                    <div className="preview-info-row">
                      <strong>Size:</strong> {(previewImage.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div className="preview-panel-actions">
                    <button
                      className="gallery-select-btn-large"
                      onClick={() => handleSelect(previewImage.path)}
                    >
                      ✓ Select This Image
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

