'use client';

import { useState, useEffect } from 'react';
import { twoQuestionsApi, TwoQuestion, CreateTwoQuestionData } from '@/lib/api';
import MultiCountrySelect from '@/components/MultiCountrySelect';
import * as XLSX from 'xlsx';
import './two-questions.css';

export default function TwoQuestionsPage() {
  const [questions, setQuestions] = useState<TwoQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [importedQuestions, setImportedQuestions] = useState<any[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TwoQuestion | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  
  // Form state
  const [formData, setFormData] = useState<CreateTwoQuestionData>({
    question: '',
    type: 'NONE',
    options: ['', '', '', ''],
    correctOption: '',
    status: 'ACTIVE',
    countries: ['ALL'] as string[],
  });

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const response = await twoQuestionsApi.getAll({
        status: statusFilter as 'ACTIVE' | 'INACTIVE' | 'ALL' | undefined,
        search: searchQuery || undefined,
        page,
        limit,
      });
      setQuestions(response.data || []);
      setPagination(response.pagination);
      setError(null);
    } catch (error) {
      console.error('Error loading questions:', error);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchQuery, page]);

  const handleDownloadSample = () => {
    const sampleData = [
      {
        Question: 'What is 2 + 2?',
        'Option 1': '3',
        'Option 2': '4',
        'Option 3': '5',
        'Option 4': '6',
        'Correct Answer': '4',
        Type: 'NONE',
        Status: 'ACTIVE',
        Countries: 'ALL',
      },
      {
        Question: 'Which is the largest ocean?',
        'Option 1': 'Atlantic',
        'Option 2': 'Indian',
        'Option 3': 'Pacific',
        'Option 4': 'Arctic',
        'Correct Answer': 'Pacific',
        Type: 'NONE',
        Status: 'ACTIVE',
        Countries: 'ALL',
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Two Questions');
    XLSX.writeFile(workbook, 'sample_two_questions.xlsx');
  };

  const handleExport = () => {
    const data = questions.map((q) => ({
      Question: q.question,
      'Option 1': q.options[0] || '',
      'Option 2': q.options[1] || '',
      'Option 3': q.options[2] || '',
      'Option 4': q.options[3] || '',
      'Correct Answer': q.correctOption,
      Type: q.type,
      Status: q.status,
      Countries: q.countries?.join(', ') || q.region || 'ALL',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Two Questions');
    XLSX.writeFile(workbook, `two_questions_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let imported: any[] = [];
      const fileName = file.name.toLowerCase();
      
      // Handle CSV files separately
      if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        for (const line of lines) {
          // Simple CSV parsing - split by comma (can be improved for quoted values)
          const columns = line.split(',').map(col => col.trim());
          
          if (columns.length >= 6) {
            const countriesCol = columns[6];
            const parsedCountries = countriesCol
              ? countriesCol.split(/[,;]/).map((c: string) => c.trim().toUpperCase()).filter(Boolean)
              : ['ALL'];
            const questionData = {
              question: columns[0] || '',
              option1: columns[1] || '',
              option2: columns[2] || '',
              option3: columns[3] || '',
              option4: columns[4] || '',
              correctOption: columns[5] || '',
              type: 'NONE',
              status: 'ACTIVE',
              countries: parsedCountries.length > 0 ? parsedCountries : ['ALL'],
              region: parsedCountries.includes('IND') && parsedCountries.length === 1 ? 'IND' : 'ALL',
            };
            
            if (questionData.question && questionData.option1 && questionData.option2) {
              imported.push(questionData);
            }
          }
        }
      } else {
        // Handle Excel files
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // First try reading as objects (with headers)
        let jsonData = XLSX.utils.sheet_to_json(sheet);
        
        // Check if we have headers by checking first row
        const firstRow = jsonData[0] as any;
        const hasHeaders = firstRow && (
          firstRow.Question || firstRow.question || 
          firstRow['Option 1'] || firstRow.option1 ||
          Object.keys(firstRow).some(key => String(key).toLowerCase().includes('question') || String(key).toLowerCase().includes('option'))
        );
        
        if (!hasHeaders) {
          // Read as arrays if no headers detected
          jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        }
        
        for (let i = 0; i < jsonData.length; i++) {
          let questionData: any = null;
          
          if (hasHeaders) {
            // Excel with headers
            const row = jsonData[i] as any;
            const countriesRaw = (row.Countries || row.countries || row.Country || row.country || row.Region || row.region || 'ALL').toString();
            const parsedCountriesExcel = countriesRaw.split(/[,;]/).map((c: string) => c.trim().toUpperCase()).filter(Boolean);
            questionData = {
              question: row.Question || row.question || '',
              option1: row['Option 1'] || row.option1 || row['Option1'] || '',
              option2: row['Option 2'] || row.option2 || row['Option2'] || '',
              option3: row['Option 3'] || row.option3 || row['Option3'] || '',
              option4: row['Option 4'] || row.option4 || row['Option4'] || '',
              correctOption: row['Correct Answer'] || row.correctAnswer || row['CorrectAnswer'] || row.correctOption || '',
              type: (row.Type || row.type || 'NONE').toUpperCase(),
              status: (row.Status || row.status || 'ACTIVE').toUpperCase(),
              countries: parsedCountriesExcel.length > 0 ? parsedCountriesExcel : ['ALL'],
              region: parsedCountriesExcel.includes('IND') && parsedCountriesExcel.length === 1 ? 'IND' : 'ALL',
            };
          } else {
            // Excel without headers - positional
            const row = jsonData[i] as any[];
            if (row && Array.isArray(row) && row.length >= 6) {
              const countriesVal = row[6] != null ? String(row[6]) : 'ALL';
              const parsedCountriesArr = countriesVal.split(/[,;]/).map((c: string) => c.trim().toUpperCase()).filter(Boolean);
              questionData = {
                question: String(row[0] || ''),
                option1: String(row[1] || ''),
                option2: String(row[2] || ''),
                option3: String(row[3] || ''),
                option4: String(row[4] || ''),
                correctOption: String(row[5] || ''),
                type: 'NONE',
                status: 'ACTIVE',
                countries: parsedCountriesArr.length > 0 ? parsedCountriesArr : ['ALL'],
                region: parsedCountriesArr.includes('IND') && parsedCountriesArr.length === 1 ? 'IND' : 'ALL',
              };
            }
          }
          
          if (questionData && questionData.question && questionData.option1 && questionData.option2) {
            imported.push(questionData);
          }
        }
      }

      if (imported.length > 0) {
        setImportedQuestions(imported);
        setShowImportPreview(true);
      } else {
        alert('No valid questions found in the file. Please ensure the file has the correct format:\n\nFor Excel: Question, Option 1, Option 2, Option 3, Option 4, Correct Answer\nFor CSV: question,option1,option2,option3,option4,correctAnswer');
      }
    } catch (err) {
      setError('Failed to import questions. Please check the file format.');
      console.error(err);
    }

    e.target.value = '';
  };

  const downloadFailedQuestionsExcel = (failedRows: { item: any; error: string }[]) => {
    const data = failedRows.map(({ item, error }) => ({
      Question: item.question || '',
      'Option 1': item.option1 || '',
      'Option 2': item.option2 || '',
      'Option 3': item.option3 || '',
      'Option 4': item.option4 || '',
      'Correct Answer': item.correctOption || '',
      Type: item.type || 'NONE',
      Status: item.status || 'ACTIVE',
      Countries: (item as any).countries?.join(', ') || (item as any).region || 'ALL',
      Error: error,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed Questions');
    const filename = `two_questions_failed_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleSaveImported = async () => {
    try {
      setLoading(true);
      let successCount = 0;
      const failedRows: { item: any; error: string }[] = [];

      for (const item of importedQuestions) {
        try {
          const options = [
            item.option1,
            item.option2,
            item.option3 || '',
            item.option4 || '',
          ]
            .map(opt => (opt != null && typeof opt !== 'string' ? String(opt) : (opt || '')))
            .filter(opt => opt.trim() !== '');

          if (options.length < 2) {
            failedRows.push({ item, error: 'At least 2 options are required' });
            continue;
          }

          const correctOptionStr = item.correctOption != null ? String(item.correctOption) : '';
          if (!correctOptionStr || !options.includes(correctOptionStr)) {
            failedRows.push({ item, error: 'Correct option must be one of the provided options' });
            continue;
          }
          const itemCountries = (item as any).countries || ['ALL'];
          await twoQuestionsApi.create({
            question: item.question,
            options: options,
            correctOption: correctOptionStr,
            type: item.type as 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO',
            status: item.status as 'ACTIVE' | 'INACTIVE',
            countries: itemCountries,
            region: itemCountries.includes('IND') && itemCountries.length === 1 ? 'IND' : 'ALL',
          });
          successCount++;
        } catch (err: any) {
          const errorMessage = err?.response?.data?.error || err?.message || 'Unknown error';
          console.error(`Failed to import question: ${item.question}`, err);
          failedRows.push({ item, error: String(errorMessage) });
        }
      }

      if (failedRows.length > 0) {
        downloadFailedQuestionsExcel(failedRows);
      }

      setImportedQuestions([]);
      setShowImportPreview(false);
      loadQuestions();
      if (failedRows.length > 0) {
        alert(`Import completed! ${successCount} imported successfully. ${failedRows.length} failed — failed questions have been downloaded as an Excel file.`);
      } else {
        alert(`Import completed! ${successCount} questions imported successfully.`);
      }
    } catch (err) {
      setError('Failed to save imported questions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }
    try {
      await twoQuestionsApi.delete(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      loadQuestions();
    } catch (err) {
      setError('Failed to delete question');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(questions.map((q) => q.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one question to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected question(s)?`)) {
      return;
    }
    try {
      setLoading(true);
      await twoQuestionsApi.deleteMany(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadQuestions();
    } catch (err) {
      setError('Failed to delete selected questions');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (questions.length === 0) {
      alert('No questions to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ALL ${questions.length} questions? This cannot be undone.`)) {
      return;
    }
    try {
      setLoading(true);
      await twoQuestionsApi.deleteMany(questions.map((q) => q.id));
      setSelectedIds(new Set());
      loadQuestions();
    } catch (err) {
      setError('Failed to delete all questions');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await twoQuestionsApi.update(id, { status: newStatus as 'ACTIVE' | 'INACTIVE' });
      loadQuestions();
    } catch (err) {
      setError('Failed to toggle status');
    }
  };

  const handleAddNew = () => {
    setEditingQuestion(null);
    setFormData({
      question: '',
      type: 'NONE',
      options: ['', '', '', ''],
      correctOption: '',
      status: 'ACTIVE',
      countries: ['ALL'] as string[],
    });
    setShowAddModal(true);
  };

  const handleEdit = (question: TwoQuestion) => {
    setEditingQuestion(question);
    setFormData({
      question: question.question,
      type: 'NONE',
      options: question.options.length === 4 ? question.options : [...question.options, '', '', '', ''].slice(0, 4),
      correctOption: question.correctOption,
      status: question.status,
      countries: question.countries || ['ALL'],
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const options = formData.options
        .map(opt => (opt != null && typeof opt !== 'string' ? String(opt) : (opt || '')))
        .filter(opt => opt.trim() !== '');
      
      if (options.length < 2) {
        setError('At least 2 options are required');
        setLoading(false);
        return;
      }

      if (!options.includes(formData.correctOption)) {
        setError('Correct option must be one of the provided options');
        setLoading(false);
        return;
      }

      const submitCountries = formData.countries || ['ALL'];
      const submitData = {
        ...formData,
        options: options,
        type: 'NONE' as const,
        media: undefined,
        countries: submitCountries,
        region: (submitCountries.includes('IND') && submitCountries.length === 1 ? 'IND' : 'ALL') as 'IND' | 'ALL',
      };

      if (editingQuestion) {
        await twoQuestionsApi.update(editingQuestion.id, submitData);
      } else {
        await twoQuestionsApi.create(submitData);
      }

      setShowAddModal(false);
      setFormData({
        question: '',
        type: 'NONE',
        options: ['', '', '', ''],
        correctOption: '',
        status: 'ACTIVE',
        countries: ['ALL'] as string[],
      });
      setEditingQuestion(null);
      loadQuestions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save question');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="two-questions-page">
      <div className="page-header">
        <h2>Manage Intro Two Questions</h2>
        <div className="header-actions">
          <button onClick={handleDownloadSample} className="btn-export" title="Download a sample Excel file with the expected format">
            Sample File
          </button>
          <label className="btn-import">
            Import from Excel/CSV
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleExport} className="btn-export">
            Export to Excel
          </button>
          <button onClick={handleAddNew} className="btn-add">
            Add Question
          </button>
          {questions.length > 0 && (
            <>
              <button
                onClick={selectedIds.size === questions.length ? deselectAll : selectAll}
                className="btn-select-all"
              >
                {selectedIds.size === questions.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                className="btn-delete-selected"
              >
                Delete Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
              <button onClick={handleDeleteAll} className="btn-delete-all">
                Delete All
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Filters - Horizontal layout */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="search-input"
            />
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Questions</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Import Preview */}
      {showImportPreview && importedQuestions.length > 0 && (
        <div className="import-preview-section">
          <h3>Import Preview ({importedQuestions.length} questions)</h3>
          <div className="import-preview-list">
            {importedQuestions.map((item, index) => (
              <div key={index} className="import-preview-item">
                <div className="preview-title">
                  <strong>{index + 1}:</strong> {item.question}
                </div>
                <div className="preview-details">
                  <span>Status: {item.status}</span>
                  <span>Correct: {item.correctOption}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="import-actions">
            <button onClick={handleSaveImported} className="btn-save-import" disabled={loading}>
              {loading ? 'Importing...' : `Import ${importedQuestions.length} Questions`}
            </button>
            <button
              onClick={() => {
                setImportedQuestions([]);
                setShowImportPreview(false);
              }}
              className="btn-cancel-import"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && !showImportPreview ? (
        <p>Loading questions...</p>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <p>No questions found.</p>
          <button onClick={handleAddNew} className="btn-primary">
            Add First Question
          </button>
        </div>
      ) : (
        <div className="two-questions-table-container">
          <table className="two-questions-table">
            <thead>
              <tr>
                <th className="col-select">
                  <label className="table-checkbox-label">
                    <input
                      type="checkbox"
                      checked={questions.length > 0 && selectedIds.size === questions.length}
                      onChange={() => questions.length > 0 && (selectedIds.size === questions.length ? deselectAll() : selectAll())}
                    />
                  </label>
                </th>
                <th>Question</th>
                <th>Options</th>
                <th>Type</th>
                <th>Status</th>
                <th>Countries</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id}>
                  <td className="col-select">
                    <label className="table-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(question.id)}
                        onChange={() => toggleSelect(question.id)}
                      />
                    </label>
                  </td>
                  <td className="question-text-cell">
                    <div className="question-text">{question.question}</div>
                  </td>
                  <td>
                    <div className="options-preview">
                      {question.options.map((opt, idx) => (
                        <div
                          key={idx}
                          className={`option-preview ${opt === question.correctOption ? 'correct' : ''}`}
                        >
                          {String.fromCharCode(65 + idx)}. {opt}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`type-badge type-${(question.type || 'NONE').toLowerCase()}`}>
                      {question.type || 'NONE'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${question.status.toLowerCase()}`}>
                      {question.status}
                    </span>
                    <button
                      onClick={() => toggleStatus(question.id, question.status)}
                      className="btn-status-toggle"
                      title={`Mark as ${question.status === 'ACTIVE' ? 'Inactive' : 'Active'}`}
                    >
                      {question.status === 'ACTIVE' ? '✓' : '○'}
                    </button>
                  </td>
                  <td>{question.countries?.join(', ') || question.region || 'ALL'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEdit(question)}
                        className="btn-edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(question.id)}
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

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px', marginBottom: '20px' }}>
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span className="pagination-info" style={{ color: '#666' }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total questions)
          </span>
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer', opacity: page === pagination.totalPages ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="question-form">
              <div className="form-group">
                <label>Question *</label>
                <textarea
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  required
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Options * (At least 2 required)</label>
                {formData.options.map((option, idx) => (
                  <input
                    key={idx}
                    type="text"
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...formData.options];
                      newOptions[idx] = e.target.value;
                      setFormData({ ...formData, options: newOptions });
                    }}
                    className="option-input"
                  />
                ))}
              </div>

              <div className="form-group">
                <label>Correct Option *</label>
                <select
                  value={formData.correctOption}
                  onChange={(e) => setFormData({ ...formData, correctOption: e.target.value })}
                  required
                >
                  <option value="">Select correct option</option>
                  {formData.options
                    .map(opt => (opt != null && typeof opt !== 'string' ? String(opt) : (opt || '')))
                    .filter(opt => opt.trim() !== '')
                    .map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {String.fromCharCode(65 + idx)}. {opt}
                      </option>
                    ))}
                </select>
              </div>


              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div className="form-group">
                <MultiCountrySelect
                  value={formData.countries || ['ALL']}
                  onChange={(countries) => setFormData({ ...formData, countries })}
                  label="Countries (intro page)"
                />
                <span className="form-hint">Which users see this question on the intro page based on their country.</span>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Saving...' : editingQuestion ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

