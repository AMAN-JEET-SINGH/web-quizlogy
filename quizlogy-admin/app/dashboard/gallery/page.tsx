'use client';

import { useState, useEffect } from 'react';
import { uploadApi, GalleryImage } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import './gallery.css';

export default function GalleryManagementPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await uploadApi.getGallery();
      let filteredImages = response.images;
      
      // Filter by type if not 'all'
      if (selectedType !== 'all') {
        filteredImages = filteredImages.filter(img => img.type === selectedType);
      }
      
      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredImages = filteredImages.filter(img => 
          img.filename.toLowerCase().includes(searchLower) ||
          img.path.toLowerCase().includes(searchLower)
        );
      }
      
      setImages(filteredImages);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load gallery');
      console.error('Gallery fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (imagePath: string) => {
    if (!window.confirm('Are you sure you want to delete this image? This action cannot be undone and will remove the file from the server.')) {
      return;
    }

    setDeletingPath(imagePath);
    try {
      await uploadApi.deleteImage(imagePath);
      // Remove from local state
      setImages(images.filter(img => img.path !== imagePath));
      if (selectedImage?.path === imagePath) {
        setSelectedImage(null);
      }
      alert('Image deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete image');
      console.error('Delete error:', err);
      alert('Failed to delete image: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingPath(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  const handleSearch = () => {
    fetchImages();
  };

  return (
    <div className="gallery-management-page">
      <div className="page-header">
        <h1>Image Gallery Management</h1>
        <div className="header-info">
          <span className="image-count">{images.length} image{images.length !== 1 ? 's' : ''}</span>
          <button 
            onClick={fetchImages} 
            className="btn-refresh"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      {/* Filters and Search */}
      <div className="gallery-controls">
        <div className="control-group">
          <label>Filter by Type:</label>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="type-filter"
          >
            <option value="all">All Images</option>
            <option value="categories">Categories</option>
            <option value="contests">Contests</option>
            <option value="funfacts">Fun Facts</option>
          </select>
        </div>
        
        <div className="control-group search-group">
          <label>Search:</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by filename..."
            className="search-input"
          />
          <button onClick={handleSearch} className="btn-search">Search</button>
          {searchTerm && (
            <button 
              onClick={() => {
                setSearchTerm('');
                fetchImages();
              }} 
              className="btn-clear-search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Image Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading images...</p>
        </div>
      ) : images.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🖼️</div>
          <h3>No images found</h3>
          <p>
            {searchTerm 
              ? `No images match "${searchTerm}"` 
              : selectedType !== 'all'
              ? `No images found in ${selectedType} folder`
              : 'No images uploaded yet'}
          </p>
        </div>
      ) : (
        <div className="gallery-grid">
          {images.map((image) => (
            <div 
              key={image.path} 
              className="gallery-card"
              onClick={() => setSelectedImage(image)}
            >
              <div className="card-image-container">
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
                <div className="card-overlay">
                  <button
                    className="btn-view"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(image);
                    }}
                  >
                    👁️ View
                  </button>
                  <button
                    className="btn-delete-card"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(image.path);
                    }}
                    disabled={deletingPath === image.path}
                  >
                    {deletingPath === image.path ? '⏳ Deleting...' : '🗑️ Delete'}
                  </button>
                </div>
              </div>
              <div className="card-info">
                <div className="card-filename" title={image.filename}>
                  {image.filename}
                </div>
                <div className="card-meta">
                  <span className={`card-type type-${image.type}`}>
                    {image.type}
                  </span>
                  <span className="card-size">{formatFileSize(image.size)}</span>
                </div>
                <div className="card-date">
                  {formatDate(image.modified)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="preview-modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h2>Image Preview</h2>
              <button className="preview-close" onClick={() => setSelectedImage(null)}>×</button>
            </div>
            
            <div className="preview-content">
              <div className="preview-image-container">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage.url}
                  alt={selectedImage.filename}
                  onError={(e) => {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                    const fallbackUrl = selectedImage.path.startsWith('uploads/') 
                      ? `${apiUrl}/${selectedImage.path}`
                      : `${apiUrl}/uploads/${selectedImage.type}/${selectedImage.filename}`;
                    (e.target as HTMLImageElement).src = fallbackUrl;
                  }}
                />
              </div>
              
              <div className="preview-details">
                <div className="detail-row">
                  <label>Filename:</label>
                  <span className="detail-value">{selectedImage.filename}</span>
                </div>
                <div className="detail-row">
                  <label>Path:</label>
                  <span className="detail-value path-value">{selectedImage.path}</span>
                </div>
                <div className="detail-row">
                  <label>Type:</label>
                  <span className={`detail-value type-badge type-${selectedImage.type}`}>
                    {selectedImage.type}
                  </span>
                </div>
                <div className="detail-row">
                  <label>Size:</label>
                  <span className="detail-value">{formatFileSize(selectedImage.size)}</span>
                </div>
                <div className="detail-row">
                  <label>Modified:</label>
                  <span className="detail-value">{formatDate(selectedImage.modified)}</span>
                </div>
                <div className="detail-row">
                  <label>URL:</label>
                  <span className="detail-value url-value" title={selectedImage.url}>
                    {selectedImage.url}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="preview-actions">
              <button
                className="btn-copy-path"
                onClick={() => {
                  navigator.clipboard.writeText(selectedImage.path);
                  alert('Path copied to clipboard!');
                }}
              >
                📋 Copy Path
              </button>
              <button
                className="btn-copy-url"
                onClick={() => {
                  navigator.clipboard.writeText(selectedImage.url);
                  alert('URL copied to clipboard!');
                }}
              >
                🔗 Copy URL
              </button>
              <button
                className="btn-delete-preview"
                onClick={() => {
                  handleDelete(selectedImage.path);
                  setSelectedImage(null);
                }}
                disabled={deletingPath === selectedImage.path}
              >
                {deletingPath === selectedImage.path ? '⏳ Deleting...' : '🗑️ Delete Image'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

