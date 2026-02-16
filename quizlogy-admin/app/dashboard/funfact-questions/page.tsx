'use client';

import { useState, useEffect } from 'react';
import { funfactsApi, FunFactQuestionWithFunFact, uploadApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import * as XLSX from 'xlsx';
import './funfact-questions.css';

export default function FunFactQuestionsPage() {
  const [questions, setQuestions] = useState<FunFactQuestionWithFunFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<FunFactQuestionWithFunFact | null>(null);
  const [filters, setFilters] = useState({
    type: '',
    search: '',
  });
  const [formData, setFormData] = useState({
    question: '',
    type: 'NONE' as 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO',
    media: '',
    options: ['', '', '', ''],
    correctOption: '',
    order: 1,
  });
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [importedQuestions, setImportedQuestions] = useState<any[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filters.type) params.type = filters.type;
      if (filters.search) params.search = filters.search;
      
      const data = await funfactsApi.getAllQuestions(params);
      setQuestions(data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load questions';
      setError(errorMessage);
      console.error('Error fetching questions:', err);
    } finally {
      setLoading(false);
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

  const selectAll = () => setSelectedIds(new Set(questions.map((q) => q.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one question to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected question(s)?`)) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await funfactsApi.deleteQuestion(id);
      }
      setSelectedIds(new Set());
      fetchQuestions();
    } catch (err) {
      setError('Failed to delete selected questions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.question.trim()) {
      setError('Please enter a question');
      return;
    }

    const validOptions = formData.options
      .map(opt => {
        // Convert numbers to strings, handle null/undefined
        if (opt === null || opt === undefined) return '';
        if (typeof opt === 'number') return String(opt);
        return String(opt || '');
      })
      .filter(opt => {
        // Allow single characters, numbers (including 0), and any non-empty string
        const trimmed = opt.trim();
        return trimmed.length > 0;
      });
    if (validOptions.length < 2) {
      setError('Please provide at least 2 options');
      return;
    }

    if (!formData.correctOption || !formData.correctOption.trim()) {
      setError('Please select a correct option');
      return;
    }

    // Ensure correctOption is one of the valid options
    if (!validOptions.includes(formData.correctOption)) {
      setError('Correct option must be one of the provided options');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // Ensure all options are strings (handle numbers and single characters)
      const optionsAsStrings = formData.options.map(opt => {
        if (opt === null || opt === undefined) return '';
        if (typeof opt === 'number') return String(opt);
        return String(opt || '');
      });

      const questionPayload = {
        question: formData.question,
        type: formData.type,
        media: formData.media || undefined,
        options: optionsAsStrings,
        correctOption: String(formData.correctOption || ''),
        order: formData.order,
      };

      if (editingQuestion) {
        await funfactsApi.updateQuestion(editingQuestion.id, questionPayload);
      } else {
        await funfactsApi.createQuestionStandalone(questionPayload);
      }
      resetForm();
      fetchQuestions();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save question';
      setError(errorMessage);
      console.error('Error saving question:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: FunFactQuestionWithFunFact) => {
    setEditingQuestion(question);
    const parsedOptions = Array.isArray(question.options)
  ? question.options.map((opt: any) =>
      typeof opt === 'string' ? opt : opt?.text ?? ''
    )
  : [];

    while (parsedOptions.length < 4) {
      parsedOptions.push('');
    }
    
    setFormData({
      question: question.question,
      type: question.type,
      media: question.media || '',
      options: parsedOptions.slice(0, 4),
      correctOption: question.correctOption,
      order: question.order,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }
    try {
      await funfactsApi.deleteQuestion(id);
      fetchQuestions();
    } catch (err) {
      setError('Failed to delete question');
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const result = await uploadApi.uploadImage(file, 'questions');
      setFormData({ ...formData, media: result.path });
    } catch (err) {
      setError('Failed to upload media');
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  const resetForm = () => {
    setFormData({
      question: '',
      type: 'NONE',
      media: '',
      options: ['', '', '', ''],
      correctOption: '',
      order: 1,
    });
    setEditingQuestion(null);
    setShowForm(false);
  };

  const addOption = () => {
    if (formData.options.length < 6) {
      setFormData({
        ...formData,
        options: [...formData.options, ''],
      });
    }
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        options: newOptions,
        correctOption: formData.correctOption === formData.options[index] ? '' : formData.correctOption,
      });
    }
  };

  const handleExport = () => {
    const data = questions.map((question) => {
      const options = Array.isArray(question.options)
          ? question.options
              .map((opt: any) =>
                typeof opt === 'string' ? opt : opt?.text ?? String(opt)
              )
              .join(' | ')
          : '';

      
      return {
        'Question': question.question,
        'Type': question.type,
        'Media Path': question.media || '',
        'Option 1': Array.isArray(question.options) && question.options[0] ? (typeof question.options[0] === 'string' ? question.options[0] : (question.options[0]?.text || question.options[0] || '')) : '',
        'Option 2': Array.isArray(question.options) && question.options[1] ? (typeof question.options[1] === 'string' ? question.options[1] : (question.options[1]?.text || question.options[1] || '')) : '',
        'Option 3': Array.isArray(question.options) && question.options[2] ? (typeof question.options[2] === 'string' ? question.options[2] : (question.options[2]?.text || question.options[2] || '')) : '',
        'Option 4': Array.isArray(question.options) && question.options[3] ? (typeof question.options[3] === 'string' ? question.options[3] : (question.options[3]?.text || question.options[3] || '')) : '',
        'Correct Option': question.correctOption,
        'Order': question.order,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fun Fact Questions');
    XLSX.writeFile(workbook, `funfact_questions_export_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        const options = [
          row['Option 1'] ?? row.option1 ?? row.Option1 ?? '',
          row['Option 2'] ?? row.option2 ?? row.Option2 ?? '',
          row['Option 3'] ?? row.option3 ?? row.Option3 ?? '',
          row['Option 4'] ?? row.option4 ?? row.Option4 ?? '',
        ]
        .map(opt => {
          // Convert numbers to strings, handle null/undefined
          if (opt === null || opt === undefined) return '';
          if (typeof opt === 'number') return String(opt);
          return String(opt);
        })
        .filter(opt => {
          // Allow single characters, numbers (including 0), and any non-empty string
          const trimmed = opt.trim();
          return trimmed.length > 0;
        });

        // Convert correctOption to string to handle numbers and single characters
        let correctOption = row['Correct Option'] ?? row.correctOption ?? row.correct ?? '';
        if (correctOption !== null && correctOption !== undefined) {
          correctOption = typeof correctOption === 'number' ? String(correctOption) : String(correctOption);
        } else {
          correctOption = '';
        }

        const questionData = {
          question: row.Question || row.question || '',
          type: (row.Type || row.type || 'NONE').toUpperCase(),
          media: row['Media Path'] || row.mediaPath || row.media || '',
          options: options,
          correctOption: correctOption,
          order: row.Order || row.order || 1,
        };

        if (questionData.question && questionData.options.length >= 2 && questionData.correctOption) {
          imported.push(questionData);
        }
      }

      if (imported.length > 0) {
        setImportedQuestions(imported);
        setShowImportPreview(true);
      } else {
        alert('No valid questions found in the file.');
      }
    } catch (err) {
      setError('Failed to import questions');
      console.error(err);
    }

    e.target.value = '';
  };

  const downloadFailedQuestionsExcel = (failedRows: { item: any; error: string }[]) => {
    const data = failedRows.map(({ item, error }) => ({
      Question: item.question || '',
      'Option 1': (item.options && item.options[0]) || '',
      'Option 2': (item.options && item.options[1]) || '',
      'Option 3': (item.options && item.options[2]) || '',
      'Option 4': (item.options && item.options[3]) || '',
      'Correct Answer': item.correctOption || '',
      Type: item.type || 'NONE',
      Order: item.order ?? '',
      Error: error,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed Questions');
    const filename = `funfact_questions_failed_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleSaveImported = async () => {
    try {
      setLoading(true);
      let successCount = 0;
      const failedRows: { item: any; error: string }[] = [];

      for (const item of importedQuestions) {
        try {
          const optionsAsStrings = (item.options || []).map((o: any) => (o != null ? String(o) : ''));
          const correctOptionStr = item.correctOption != null ? String(item.correctOption) : '';
          if (!correctOptionStr || !optionsAsStrings.includes(correctOptionStr)) {
            failedRows.push({ item, error: 'Correct option must be one of the provided options' });
            continue;
          }
          await funfactsApi.createQuestionStandalone({ ...item, options: optionsAsStrings, correctOption: correctOptionStr });
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
      fetchQuestions();
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

  return (
    <div className="funfact-questions-page admin-page">
      <div className="admin-page-header page-header">
        <h1>Fun Fact Questions</h1>
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
          <button onClick={() => setShowForm(true)} className="btn-add">
            Create Question
          </button>
          {questions.length > 0 && (
            <>
              <button onClick={selectedIds.size === questions.length ? deselectAll : selectAll} className="btn-select-all">
                {selectedIds.size === questions.length ? 'Deselect All' : 'Select All'}
              </button>
              <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} className="btn-delete-selected">
                Delete Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search questions..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div className="filter-group">
            <label>Media Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="NONE">Text Only</option>
              <option value="IMAGE">Image</option>
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Audio</option>
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
                <div className="preview-question">
                  <strong>Q{index + 1}:</strong> {item.question}
                </div>
                <div className="preview-details">
                  <span>Type: {item.type}</span>
                  <span>Options: {item.options.length}</span>
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

      {/* Questions List */}
      {loading ? (
        <div className="loading">Loading questions...</div>
      ) : questions.length === 0 ? (
        <div className="empty-state">No questions found.</div>
      ) : (
        <div className="questions-table-container">
          <table className="questions-table">
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
                <th>Type</th>
                <th>Options</th>
                <th>Correct</th>
                <th>Order</th>
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
                  <td>
                    <div className="question-cell">
                      <div className="question-text">{question.question}</div>
                      {question.media && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getImageUrl(question.media)} alt="Media" className="question-media" />
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`type-badge ${question.type.toLowerCase()}`}>
                      {question.type}
                    </span>
                  </td>
                  <td>
                    <div className="options-preview">
                      {question.options.slice(0, 2).map((opt: any, idx: number) => {
                        const optionText = typeof opt === 'string' ? opt : (opt.text || opt);
                        return (
                          <div key={idx} className="option-preview">
                            {String.fromCharCode(65 + idx)}. {optionText}
                          </div>
                        );
                      })}
                      {question.options.length > 2 && (
                        <span className="more-options">+{question.options.length - 2} more</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="correct-option">{question.correctOption}</span>
                  </td>
                  <td>{question.order}</td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => handleEdit(question)} className="btn-edit">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(question.id)} className="btn-delete">
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

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingQuestion ? 'Edit Question' : 'Create Question'}</h3>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="question-form">
              <div className="form-group">
                <label>Question *</label>
                <textarea
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="Enter question text"
                  rows={3}
                  required
                />
              </div>

              <div className="form-group">
                <label>Media Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <option value="NONE">Text Only</option>
                  <option value="IMAGE">Image</option>
                  <option value="VIDEO">Video</option>
                  <option value="AUDIO">Audio</option>
                </select>
              </div>

              {formData.type !== 'NONE' && (
                <div className="form-group">
                  <label>Media</label>
                  {formData.media ? (
                    <div className="media-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getImageUrl(formData.media)} alt="Preview" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, media: '' })}
                        className="btn-remove-media"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="btn-upload">
                      {uploadingMedia ? 'Uploading...' : 'Upload Media'}
                      <input
                        type="file"
                        accept="image/*,video/*,audio/*"
                        onChange={handleMediaUpload}
                        style={{ display: 'none' }}
                        disabled={uploadingMedia}
                      />
                    </label>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Options</label>
                {formData.options.map((option, index) => (
                  <div key={index} className="option-input-row">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[index] = e.target.value;
                        setFormData({ ...formData, options: newOptions });
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="option-input"
                    />
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="correctOption"
                        value={option}
                        checked={formData.correctOption === option}
                        onChange={(e) => setFormData({ ...formData, correctOption: e.target.value })}
                        disabled={!option.trim()}
                      />
                      <span className="radio-label-text">Correct</span>
                    </label>
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="btn-remove-option"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {formData.options.length < 6 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="btn-add-option"
                  >
                    + Add Option
                  </button>
                )}
              </div>

              <div className="form-group">
                <label>Order</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={!formData.question.trim()}>
                  {editingQuestion ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
