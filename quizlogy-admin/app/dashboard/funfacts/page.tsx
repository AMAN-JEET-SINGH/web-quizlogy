'use client';

import { useState, useEffect } from 'react';
import { funfactsApi, FunFact, CreateFunFactData, uploadApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import * as XLSX from 'xlsx';
import './funfacts.css';

export default function FunFactsPage() {
  const [funfacts, setFunfacts] = useState<FunFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [importedFunfacts, setImportedFunfacts] = useState<any[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === funfacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(funfacts.map(f => f.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} fun fact(s)?`)) return;
    try {
      setLoading(true);
      let deleted = 0;
      for (const id of selectedIds) {
        try {
          await funfactsApi.delete(id);
          deleted++;
        } catch {}
      }
      setSelectedIds(new Set());
      loadFunfacts();
      alert(`${deleted} fun fact(s) deleted successfully.`);
    } catch {
      setError('Failed to delete selected fun facts');
    } finally {
      setLoading(false);
    }
  };

  const loadFunfacts = async () => {
    setLoading(true);
    try {
      const response = await funfactsApi.getAll(statusFilter as 'ACTIVE' | 'INACTIVE' | undefined);
      setFunfacts(response.data || []);
      setError(null);
    } catch (error) {
      console.error('Error loading funfacts:', error);
      setError('Failed to load funfacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFunfacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleExport = () => {
    const data = funfacts.map((funfact) => ({
      Title: funfact.title,
      Description: funfact.description || '',
      'Image Path': funfact.imagePath || '',
      Status: funfact.status,
      'Question Count': funfact.questionCount || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fun Facts');
    XLSX.writeFile(workbook, `funfacts_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      const imported: any[] = [];
      for (const row of jsonData as any[]) {
        const funfactData = {
          title: row.Title || row.title || '',
          description: row.Description || row.description || '',
          imagePath: row['Image Path'] || row.imagePath || row.image || '',
          status: (row.Status || row.status || 'ACTIVE').toUpperCase(),
        };

        if (funfactData.title) {
          imported.push(funfactData);
        }
      }

      if (imported.length > 0) {
        setImportedFunfacts(imported);
        setShowImportPreview(true);
      } else {
        alert('No valid fun facts found in the file.');
      }
    } catch (err) {
      setError('Failed to import fun facts');
      console.error(err);
    }

    e.target.value = '';
  };

  const downloadFailedExcel = (failedRows: { item: any; error: string }[]) => {
    const data = failedRows.map(({ item, error }) => ({
      Title: item.title || '',
      Description: item.description || '',
      'Image Path': item.imagePath || '',
      Status: item.status || 'ACTIVE',
      Error: error,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed Fun Facts');
    XLSX.writeFile(workbook, `funfacts_failed_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
  };

  const handleSaveImported = async () => {
    try {
      setLoading(true);
      let successCount = 0;
      const failedRows: { item: any; error: string }[] = [];

      for (const item of importedFunfacts) {
        try {
          await funfactsApi.create(item);
          successCount++;
        } catch (err: any) {
          const errorMessage = err?.response?.data?.error || err?.message || 'Unknown error';
          failedRows.push({ item, error: String(errorMessage) });
        }
      }

      if (failedRows.length > 0) {
        downloadFailedExcel(failedRows);
      }
      setImportedFunfacts([]);
      setShowImportPreview(false);
      loadFunfacts();
      if (failedRows.length > 0) {
        alert(`Import completed! ${successCount} imported. ${failedRows.length} failed — failed rows downloaded as Excel.`);
      } else {
        alert(`Import completed! ${successCount} fun facts imported successfully.`);
      }
    } catch (err) {
      setError('Failed to save imported fun facts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this funfact?')) {
      return;
    }
    try {
      await funfactsApi.delete(id);
      loadFunfacts();
    } catch (err) {
      setError('Failed to delete funfact');
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await funfactsApi.update(id, { status: newStatus as 'ACTIVE' | 'INACTIVE' });
      loadFunfacts();
    } catch (err) {
      setError('Failed to toggle status');
    }
  };

  return (
    <div className="funfacts-page">
      <div className="page-header">
        <h2>Manage Fun Facts</h2>
        <div className="header-actions">
          <label className="btn-import">
            Import from Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleExport} className="btn-export">
            Export to Excel
          </button>
          <a href="/dashboard/funfacts/add" className="btn-add">
            Add Fun Fact
          </a>
          {selectedIds.size > 0 && (
            <button onClick={handleDeleteSelected} className="btn-delete" style={{ marginLeft: '8px' }}>
              Delete Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Status Filter */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Filter by Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Fun Facts</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Import Preview */}
      {showImportPreview && importedFunfacts.length > 0 && (
        <div className="import-preview-section">
          <h3>Import Preview ({importedFunfacts.length} fun facts)</h3>
          <div className="import-preview-list">
            {importedFunfacts.map((item, index) => (
              <div key={index} className="import-preview-item">
                <div className="preview-title">
                  <strong>{index + 1}:</strong> {item.title}
                </div>
                <div className="preview-details">
                  <span>Status: {item.status}</span>
                  {item.description && <span>Description: {item.description.substring(0, 50)}...</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="import-actions">
            <button onClick={handleSaveImported} className="btn-save-import" disabled={loading}>
              {loading ? 'Importing...' : `Import ${importedFunfacts.length} Fun Facts`}
            </button>
            <button
              onClick={() => {
                setImportedFunfacts([]);
                setShowImportPreview(false);
              }}
              className="btn-cancel-import"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading funfacts...</p>
      ) : funfacts.length === 0 ? (
        <div className="empty-state">
          <p>No funfacts found.</p>
          <a href="/dashboard/funfacts/add" className="btn-primary">
            Add First Fun Fact
          </a>
        </div>
      ) : (
        <div className="funfacts-table-container">
          <table className="funfacts-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={funfacts.length > 0 && selectedIds.size === funfacts.length}
                    onChange={toggleSelectAll}
                    title="Select all"
                  />
                </th>
                <th>Title</th>
                <th>Description</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {funfacts.map((funfact) => (
                <tr key={funfact.id} style={{ background: selectedIds.has(funfact.id) ? 'var(--admin-accent-light, #eef2ff)' : undefined }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(funfact.id)}
                      onChange={() => toggleSelect(funfact.id)}
                    />
                  </td>
                  <td><strong>{funfact.title}</strong></td>
                  <td>
                    <span className="funfact-description-cell" title={funfact.description || ''}>
                      {funfact.description
                        ? funfact.description.length > 60
                          ? funfact.description.substring(0, 60) + '...'
                          : funfact.description
                        : '-'}
                    </span>
                  </td>
                  <td>
                    <span className="questions-count-badge">
                      {funfact.questionCount ?? 0}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${funfact.status.toLowerCase()}`}>
                      {funfact.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => toggleStatus(funfact.id, funfact.status)}
                        className={`btn-status ${funfact.status.toLowerCase()}`}
                        title={`Mark as ${funfact.status === 'ACTIVE' ? 'Inactive' : 'Active'}`}
                      >
                        {funfact.status === 'ACTIVE' ? '✓' : '○'}
                      </button>
                      <a
                        href={`/dashboard/funfacts/edit/${funfact.id}`}
                        className="btn-edit"
                      >
                        Edit
                      </a>
                      <button
                        onClick={() => handleDelete(funfact.id)}
                        className="btn-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

