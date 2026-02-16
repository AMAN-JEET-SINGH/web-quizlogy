'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { battlesApi, Battle, CreateBattleData, uploadApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import ImageGallery from '@/components/ImageGallery';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import './battles.css';

export default function BattleManagement() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [filteredBattles, setFilteredBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBattle, setEditingBattle] = useState<Battle | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<CreateBattleData>({
    name: '',
    description: '',
    imagePath: '',
    backgroundColorTop: '#C0FFE3',
    backgroundColorBottom: '#00AB5E',
    status: 'ACTIVE',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageSelection, setShowImageSelection] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [importedData, setImportedData] = useState<any[]>([]);
  
  // Filter states
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterName, setFilterName] = useState<string>('');
  const [filterDescription, setFilterDescription] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    fetchBattles();
  }, []);

  const fetchBattles = async () => {
    try {
      setLoading(true);
      const data = await battlesApi.getAll();
      setBattles(data);
      setFilteredBattles(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch battles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const applyFilters = useCallback(() => {
    let filtered = [...battles];

    if (filterStatus) {
      filtered = filtered.filter(battle => battle.status === filterStatus);
    }

    if (filterName) {
      filtered = filtered.filter(battle => 
        battle.name.toLowerCase().includes(filterName.toLowerCase())
      );
    }

    if (filterDescription) {
      filtered = filtered.filter(battle => 
        battle.description?.toLowerCase().includes(filterDescription.toLowerCase())
      );
    }

    setFilteredBattles(filtered);
  }, [battles, filterStatus, filterName, filterDescription]);

  // Update filtered battles when battles or filters change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Clear filters
  const clearFilters = () => {
    setFilterStatus('');
    setFilterName('');
    setFilterDescription('');
    setFilteredBattles(battles);
    setShowFilter(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBattle) {
        await battlesApi.update(editingBattle.id, formData);
      } else {
        await battlesApi.create(formData);
      }
      resetForm();
      await fetchBattles();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save battle');
    }
  };

  const handleEdit = (battle: Battle) => {
    setEditingBattle(battle);
    setFormData({
      name: battle.name,
      description: battle.description || '',
      imagePath: battle.imagePath,
      backgroundColorTop: (battle as any).backgroundColorTop || '#C0FFE3',
      backgroundColorBottom: (battle as any).backgroundColorBottom || '#00AB5E',
      status: battle.status,
    });
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredBattles.map((b) => b.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one battle to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected battle(s)? This will also delete all their questions.`)) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await battlesApi.delete(id);
      }
      setSelectedIds(new Set());
      fetchBattles();
    } catch (err) {
      setError('Failed to delete selected battles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this battle? This will also delete all its questions.')) {
      return;
    }
    try {
      await battlesApi.delete(id);
      fetchBattles();
    } catch (err) {
      setError('Failed to delete battle');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const result = await uploadApi.uploadImage(file, 'battles');
      setFormData({ ...formData, imagePath: result.path });
    } catch (err) {
      setError('Failed to upload image');
      console.error(err);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleImageSelectFromGallery = (imagePath: string) => {
    setFormData({ ...formData, imagePath });
    setShowGallery(false);
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
      })).filter((item: any) => item.name); // Only include items with names

      setImportedData(imported);
      setShowImageSelection(true);
    } catch (err) {
      setError('Failed to import battles');
      console.error(err);
    }

    e.target.value = '';
  };

  const handleImageSelectForImport = async (index: number, file: File) => {
    try {
      const result = await uploadApi.uploadImage(file, 'battles');
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed Battles');
    XLSX.writeFile(workbook, `battles_failed_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
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
          const battleData: CreateBattleData = {
            name: item.name,
            description: item.description || '',
            imagePath: item.imagePath || 'uploads/categories/placeholder.jpg',
            backgroundColorTop: item.backgroundColorTop || '#C0FFE3',
            backgroundColorBottom: item.backgroundColorBottom || '#00AB5E',
            status: status as 'ACTIVE' | 'INACTIVE',
          };
          await battlesApi.create(battleData);
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
      await fetchBattles();
      if (failedRows.length > 0) {
        alert(`Import completed! ${successCount} imported. ${failedRows.length} failed — failed rows downloaded as Excel.`);
      } else {
        alert('Battles imported successfully!');
      }
    } catch (err: any) {
      console.error('❌ Import error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save imported battles');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const data = battles.map((battle) => ({
      Name: battle.name,
      Description: battle.description || '',
      'Image Path': battle.imagePath,
      Status: battle.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Battles');
    XLSX.writeFile(workbook, 'battles.xlsx');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      imagePath: '',
      backgroundColorTop: '#C0FFE3',
      backgroundColorBottom: '#00AB5E',
      status: 'ACTIVE',
    });
    setEditingBattle(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">Loading battles...</div>;
  }

  return (
    <div className="battle-management admin-page">
      <div className="admin-page-header page-header">
        <h1>Battle Management</h1>
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
            title="Clear Filters"
            disabled={!filterStatus && !filterName && !filterDescription}
          >
            <svg className="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <label className="btn-import">
            <span className="btn-icon">📥</span>
            <span>Import from Excel</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleExport} className="btn-export">
            <span className="btn-icon">📤</span>
            <span>Export to Excel</span>
          </button>
          {filteredBattles.length > 0 && (
            <>
              <button onClick={selectedIds.size === filteredBattles.length ? deselectAll : selectAll} className="btn-select-all">
                {selectedIds.size === filteredBattles.length ? 'Deselect All' : 'Select All'}
              </button>
              <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} className="btn-delete-selected">
                Delete Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            </>
          )}
        </div>
      </div>

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

      {showFilter && (
        <div className="filter-panel">
          <div className="filter-group">
            <label>Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Name</label>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Search by name..."
            />
          </div>
          <div className="filter-group">
            <label>Description</label>
            <input
              type="text"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
              placeholder="Search by description..."
            />
          </div>
        </div>
      )}

      {showForm && (
        <div ref={formRef} className="form-panel">
          <h2>{editingBattle ? 'Edit Battle' : 'Create New Battle'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
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
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
                <button
                  type="button"
                  onClick={() => setShowGallery(true)}
                  className="btn-select-gallery"
                >
                  Select from Gallery
                </button>
                {formData.imagePath && (
                  <div className="image-preview">
                    <div 
                      className="image-preview-container"
                      style={{
                        background: `linear-gradient(0deg, ${formData.backgroundColorBottom || '#00AB5E'} 0%, ${formData.backgroundColorTop || '#C0FFE3'} 100%)`,
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
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <span>{formData.imagePath}</span>
                  </div>
                )}
                {uploadingImage && <div className="upload-status">Uploading...</div>}
              </div>
            </div>
            <div className="form-group">
              <label>Background Gradient Colors</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <label style={{ minWidth: '80px', fontSize: '14px' }}>Top Color:</label>
                  <input
                    type="color"
                    value={formData.backgroundColorTop || '#C0FFE3'}
                    onChange={(e) => setFormData({ ...formData, backgroundColorTop: e.target.value })}
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
                    value={formData.backgroundColorTop || '#C0FFE3'}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                        setFormData({ ...formData, backgroundColorTop: value });
                      }
                    }}
                    placeholder="#C0FFE3"
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <label style={{ minWidth: '80px', fontSize: '14px' }}>Bottom Color:</label>
                  <input
                    type="color"
                    value={formData.backgroundColorBottom || '#00AB5E'}
                    onChange={(e) => setFormData({ ...formData, backgroundColorBottom: e.target.value })}
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
                    value={formData.backgroundColorBottom || '#00AB5E'}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                        setFormData({ ...formData, backgroundColorBottom: value });
                      }
                    }}
                    placeholder="#00AB5E"
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <div 
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '8px',
                    background: `linear-gradient(0deg, ${formData.backgroundColorBottom || '#00AB5E'} 0%, ${formData.backgroundColorTop || '#C0FFE3'} 100%)`,
                    border: '1px solid #ddd',
                    marginTop: '4px'
                  }}
                />
              </div>
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
            <div className="form-actions">
              <button type="submit" className="btn-save">
                {editingBattle ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="btn-cancel">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <ImageGallery
        isOpen={showGallery}
        onSelect={handleImageSelectFromGallery}
        onClose={() => setShowGallery(false)}
        filterType="battles"
      />

      {showImageSelection && importedData.length > 0 && (
        <div className="import-image-selection">
          <h3>Select Images for Imported Battles</h3>
          <p>Upload images for each battle. Battles without images will use default placeholder.</p>
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
                      <img src={getImageUrl(item.imagePath)} alt={item.name} />
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
              Save All Battles
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

      <div className="battles-table-container">
        <table className="battles-table">
          <thead>
            <tr>
              <th className="col-select">
                <label className="table-checkbox-label">
                  <input
                    type="checkbox"
                    checked={filteredBattles.length > 0 && selectedIds.size === filteredBattles.length}
                    onChange={() => filteredBattles.length > 0 && (selectedIds.size === filteredBattles.length ? deselectAll() : selectAll())}
                  />
                </label>
              </th>
              <th>Image</th>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Questions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBattles.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-data">
                  {battles.length > 0 ? 'No battles match the current filters.' : 'No battles found. Create one to get started!'}
                </td>
              </tr>
            ) : (
              filteredBattles.map((battle) => (
                <tr key={battle.id}>
                  <td className="col-select">
                    <label className="table-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(battle.id)}
                        onChange={() => toggleSelect(battle.id)}
                      />
                    </label>
                  </td>
                  <td>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={battle.imageUrl || getImageUrl(battle.imagePath)}
                      alt={battle.name}
                      className="battle-thumbnail"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        console.error('Image failed to load:', {
                          battleName: battle.name,
                          attemptedSrc: img.src,
                          imagePath: battle.imagePath,
                        });
                      }}
                    />
                  </td>
                  <td>{battle.name}</td>
                  <td>{battle.description || '-'}</td>
                  <td>
                    <span className={`status-badge ${battle.status.toLowerCase()}`}>
                      {battle.status}
                    </span>
                  </td>
                  <td className="text-center">
                    <Link href={`/dashboard/battles/${battle.id}/questions`}>
                      <span className="question-count-link">
                        {battle.questions?.length || 0} Questions
                      </span>
                    </Link>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <Link href={`/dashboard/battles/${battle.id}/questions`}>
                        <button className="btn-manage-questions" title="Manage Questions">
                          Questions
                        </button>
                      </Link>
                      <button
                        onClick={() => handleEdit(battle)}
                        className="btn-edit"
                        title="Edit Battle"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(battle.id)}
                        className="btn-delete"
                        title="Delete Battle"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
