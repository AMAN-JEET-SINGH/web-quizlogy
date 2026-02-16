'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { categoriesApi, Category, CreateCategoryData, uploadApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import * as XLSX from 'xlsx';
import ImageGallery from '@/components/ImageGallery';
import MultiCountrySelect from '@/components/MultiCountrySelect';
import './categories.css';

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState<CreateCategoryData>({
    name: '',
    description: '',
    imagePath: '',
    backgroundColor: '#FFFFFF',
    status: 'ACTIVE',
    countries: ['ALL'] as string[],
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [importedData, setImportedData] = useState<any[]>([]);
  const [showImageSelection, setShowImageSelection] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  
  // Filter states
  const [showFilter, setShowFilter] = useState(false);
  
  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000); // Auto-dismiss after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [error]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterName, setFilterName] = useState<string>('');
  const [filterDescription, setFilterDescription] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Error timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000); // Auto-dismiss after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await categoriesApi.getAll();
      console.log('📥 Fetched categories:', data);
      // Log all categories' image info for debugging
      data.forEach((category, index) => {
        console.log(`📸 Category ${index + 1} (${category.name}):`, {
          imagePath: category.imagePath,
          imagePathType: typeof category.imagePath,
          imagePathValue: category.imagePath,
          imageUrl: category.imageUrl,
          computedUrl: getImageUrl(category.imagePath),
        });
      });
      setCategories(data);
      setFilteredCategories(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch categories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const applyFilters = useCallback(() => {
    let filtered = [...categories];

    if (filterStatus) {
      filtered = filtered.filter(cat => cat.status === filterStatus);
    }

    if (filterName) {
      filtered = filtered.filter(cat => 
        cat.name.toLowerCase().includes(filterName.toLowerCase())
      );
    }

    if (filterDescription) {
      filtered = filtered.filter(cat => 
        cat.description?.toLowerCase().includes(filterDescription.toLowerCase())
      );
    }

    setFilteredCategories(filtered);
  }, [categories, filterStatus, filterName, filterDescription]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredCategories.map((c) => c.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one category to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected category(ies)?\n\nThis will also delete all contests in these categories.\nQuestions will be preserved.`)) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await categoriesApi.delete(id);
      }
      setSelectedIds(new Set());
      fetchCategories();
    } catch (err) {
      setError('Failed to delete selected categories');
    } finally {
      setLoading(false);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilterStatus('');
    setFilterName('');
    setFilterDescription('');
    setFilteredCategories(categories);
    setShowFilter(false);
  };

  // Update filtered categories when categories or filters change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, formData);
      } else {
        await categoriesApi.create(formData);
      }
      resetForm();
      await fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save category');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      imagePath: category.imagePath,
      backgroundColor: category.backgroundColor || '#FFFFFF',
      status: category.status,
      countries: category.countries || ['ALL'],
    });
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?\n\nThis will also delete all contests in this category.\nQuestions will be preserved.')) {
      return;
    }
    try {
      await categoriesApi.delete(id);
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete category');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const result = await uploadApi.uploadImage(file, 'categories');
      setFormData({ ...formData, imagePath: result.path });
    } catch (err) {
      setError('Failed to upload image');
      console.error(err);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      // Store imported data without images - user will select images after
      const imported = jsonData.map((row: any) => ({
        name: row.name || row.Name || '',
        description: row.description || row.Description || '',
        status: (row.status || row.Status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
        imagePath: '', // Will be set when user uploads image
        countries: (row.countries || row.Countries || 'ALL').split(',').map((c: string) => c.trim()).filter(Boolean),
      })).filter((item: any) => item.name); // Only include items with names

      setImportedData(imported);
      setShowImageSelection(true);
    } catch (err) {
      setError('Failed to import categories');
      console.error(err);
    }

    e.target.value = '';
  };

  const handleImageSelectForImport = async (index: number, file: File) => {
    try {
      const result = await uploadApi.uploadImage(file, 'categories');
      const updated = [...importedData];
      updated[index].imagePath = result.path;
      setImportedData(updated);
    } catch (err) {
      setError(`Failed to upload image for ${importedData[index].name}`);
      console.error(err);
    }
  };

  const downloadFailedExcel = (failedRows: { item: any; error: string }[]) => {
    const data = failedRows.map(({ item, error }) => ({
      Name: item.name || '',
      Description: item.description || '',
      'Image Path': item.imagePath || '',
      Status: item.status || 'ACTIVE',
      Error: error,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed Categories');
    XLSX.writeFile(workbook, `categories_failed_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
  };

  const handleSaveImported = async () => {
    try {
      setLoading(true);
      setError(null);
      const failedRows: { item: any; error: string }[] = [];

      for (const item of importedData) {
        if (!item.name) {
          failedRows.push({ item, error: 'Name is required' });
          continue;
        }
        try {
          const status = (item.status || 'active').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
          const categoryData: CreateCategoryData = {
            name: item.name,
            description: item.description || '',
            imagePath: item.imagePath || 'uploads/categories/placeholder.jpg',
            status: status as 'ACTIVE' | 'INACTIVE',
            countries: item.countries || ['ALL'],
          };
          await categoriesApi.create(categoryData);
        } catch (err: any) {
          const errorMessage = err?.response?.data?.error || err?.message || 'Unknown error';
          failedRows.push({ item, error: String(errorMessage) });
        }
      }

      if (failedRows.length > 0) {
        downloadFailedExcel(failedRows);
      }
      const successCount = importedData.length - failedRows.length;
      setImportedData([]);
      setShowImageSelection(false);
      await fetchCategories();
      if (failedRows.length > 0) {
        alert(`Import completed! ${successCount} imported. ${failedRows.length} failed — failed rows downloaded as Excel.`);
      } else {
        alert('Categories imported successfully!');
      }
    } catch (err: any) {
      console.error('❌ Import error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save imported categories');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const data = categories.map((cat) => ({
      Name: cat.name,
      Description: cat.description || '',
      'Image Path': cat.imagePath,
      Status: cat.status,
      Countries: cat.countries?.join(', ') || 'ALL',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Categories');
    XLSX.writeFile(workbook, 'categories.xlsx');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      imagePath: '',
      backgroundColor: '#FFFFFF',
      status: 'ACTIVE',
      countries: ['ALL'],
    });
    setEditingCategory(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">Loading categories...</div>;
  }

  return (
    <div className="category-management admin-page">
      <div className="admin-page-header page-header">
        <h1>Category Management</h1>
        <div className="header-actions">
          <button onClick={() => setShowForm(!showForm)} className="btn-add-new">
            <svg className="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New</span>
          </button>
          <button 
            onClick={() => setShowFilter(!showFilter)} 
            className={`btn-filter ${showFilter ? 'active' : ''}`}
            title={showFilter ? 'Hide Filter' : 'Show Filter'}
          >
            <svg className="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
          <button 
            onClick={clearFilters} 
            className="btn-clear-filter" 
            title="Clear Filter"
            disabled={!filterStatus && !filterName && !filterDescription}
          >
            <svg className="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <label className="btn-import">
            <svg className="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Import from Excel</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleExport} className="btn-export">
            <svg className="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export to Excel</span>
          </button>
          {filteredCategories.length > 0 && (
            <>
              <button onClick={selectedIds.size === filteredCategories.length ? deselectAll : selectAll} className="btn-select-all">
                {selectedIds.size === filteredCategories.length ? 'Deselect All' : 'Select All'}
              </button>
              <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} className="btn-delete-selected">
                Delete Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            </>
          )}
        </div>
      </div>

      {showFilter && (
        <div className="filter-section">
          <div className="filter-row">
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Search by Name</label>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Enter category name"
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Search by Description</label>
              <input
                type="text"
                value={filterDescription}
                onChange={(e) => setFilterDescription(e.target.value)}
                placeholder="Enter description"
                className="filter-input"
              />
            </div>
          </div>
          <button onClick={applyFilters} className="btn-apply-filter">
            Apply Filter
          </button>
        </div>
      )}

      {error && (
        <div className="error-badge">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button 
            className="error-close" 
            onClick={() => setError(null)}
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}

      {showForm && (
        <form ref={formRef} onSubmit={handleSubmit} className="category-form">
          <h3>{editingCategory ? 'Edit Category' : 'Create New Category'}</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Category Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          <MultiCountrySelect
            value={formData.countries || ['ALL']}
            onChange={(countries) => setFormData({ ...formData, countries })}
          />
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Image</label>
            <div className="image-upload-section">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <label className="btn-upload">
                  {uploadingImage ? 'Uploading...' : formData.imagePath ? 'Change Image' : 'Upload New'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                    disabled={uploadingImage}
                  />
                </label>
                <button
                  type="button"
                  className="btn-upload gallery-btn"
                  onClick={() => setShowGallery(true)}
                >
                  Choose from Gallery
                </button>
              </div>
              {formData.imagePath && (
                <div className="image-preview">
                  <div
                    className="image-preview-container"
                    style={{
                      backgroundColor: formData.backgroundColor || '#FFFFFF',
                      padding: '12px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '120px',
                      minHeight: '120px'
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageUrl(formData.imagePath)}
                      alt="Preview"
                      style={{
                        display: 'block',
                        maxWidth: '100px',
                        maxHeight: '100px',
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        // Retry once with cache-busted URL after a short delay
                        if (!img.dataset.retried) {
                          img.dataset.retried = 'true';
                          setTimeout(() => {
                            img.src = getImageUrl(formData.imagePath) + '?t=' + Date.now();
                          }, 500);
                        }
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#666' }}>{formData.imagePath.split('/').pop()}</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imagePath: '' })}
                      className="btn-remove-image"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              {!formData.imagePath && (
                <p className="image-hint">No image selected. Default placeholder will be used.</p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Background Color</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="color"
                value={formData.backgroundColor || '#FFFFFF'}
                onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                style={{
                  width: '60px',
                  height: '40px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              />
              <input
                type="text"
                value={formData.backgroundColor || '#FFFFFF'}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value) || value === '') {
                    setFormData({ ...formData, backgroundColor: value || '#FFFFFF' });
                  }
                }}
                placeholder="#FFFFFF"
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                }}
              />
            </div>
            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              This color will be used as the background for contests in this category
            </small>
          </div>
          
          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={!formData.name}>
              {editingCategory ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="btn-cancel">
              Cancel
            </button>
          </div>
        </form>
      )}

      {showImageSelection && importedData.length > 0 && (
        <div className="import-image-selection">
          <h3>Select Images for Imported Categories</h3>
          <p>Upload images for each category. Categories without images will use default placeholder.</p>
          <div className="imported-items">
            {importedData.map((item, index) => (
              <div key={index} className="imported-item">
                <div className="item-info">
                  <strong>{item.name}</strong>
                  {item.description && <p>{item.description}</p>}
                </div>
                <div className="item-image">
                  {item.imagePath && getImageUrl(item.imagePath) ? (
                    <div className="image-preview-small">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getImageUrl(item.imagePath)!.replace('localhost:3000', 'localhost:5001')} alt={item.name} />
                      <button
                        onClick={() => {
                          const updated = [...importedData];
                          updated[index].imagePath = '';
                          setImportedData(updated);
                        }}
                        className="btn-remove"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="btn-upload-small">
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelectForImport(index, file);
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="import-actions">
            <button onClick={handleSaveImported} className="btn-save-import">
              Save All Categories
            </button>
            <button
              onClick={() => {
                setImportedData([]);
                setShowImageSelection(false);
              }}
              className="btn-cancel-import"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="categories-table-container">
        <table className="categories-table">
          <thead>
            <tr>
              <th className="col-select">
                <label className="table-checkbox-label">
                  <input
                    type="checkbox"
                    checked={filteredCategories.length > 0 && selectedIds.size === filteredCategories.length}
                    onChange={() => filteredCategories.length > 0 && (selectedIds.size === filteredCategories.length ? deselectAll() : selectAll())}
                  />
                </label>
              </th>
              <th>Image</th>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Countries</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map((category) => (
              <tr key={category.id}>
                <td className="col-select">
                  <label className="table-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(category.id)}
                      onChange={() => toggleSelect(category.id)}
                    />
                  </label>
                </td>
                <td>
                  <div
                    className="category-thumbnail-container"
                    style={{
                      backgroundColor: category.backgroundColor || '#FFFFFF',
                      padding: '4px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '60px',
                      height: '60px'
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={(category.imageUrl || getImageUrl(category.imagePath))?.replace('localhost:3000', 'localhost:5001')}
                      alt={`${category.name} - Path: ${category.imagePath || 'null'} - URL: ${category.imageUrl || 'null'}`}
                      className="category-thumbnail"
                      style={{
                        objectFit: 'contain',
                        maxWidth: '100%',
                        maxHeight: '100%'
                      }}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (!img.dataset.retried) {
                          img.dataset.retried = 'true';
                          setTimeout(() => {
                            img.src = getImageUrl(category.imagePath) + '?t=' + Date.now();
                          }, 500);
                        }
                      }}
                      onLoad={() => {
                        console.log('✅ Image loaded successfully:', {
                          categoryName: category.name,
                          src: (document.querySelector(`img[alt*="${category.name}"]`) as HTMLImageElement)?.src,
                        });
                      }}
                    />
                  </div>
                </td>
                <td>{category.name}</td>
                <td>{category.description || '-'}</td>
                <td>
                  <span className={`status-badge ${category.status}`}>
                    {category.status}
                  </span>
                </td>
                <td>{category.countries?.join(', ') || 'ALL'}</td>
                <td>
                  <div className="action-buttons">
                    <button onClick={() => handleEdit(category)} className="btn-edit">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(category.id)} className="btn-delete">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCategories.length === 0 && categories.length > 0 && (
          <div className="no-data">No categories match the current filters.</div>
        )}
        {categories.length === 0 && (
          <div className="no-data">No categories found. Create one to get started!</div>
        )}
      </div>
      
      {/* Image Gallery Modal - Always available */}
      <ImageGallery
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        onSelect={(imagePath) => {
          setFormData((prevFormData) => ({ ...prevFormData, imagePath }));
        }}
        filterType="categories"
      />
    </div>
  );
}

