'use client';

import { useState, useEffect } from 'react';
import { questionsApi, categoriesApi, contestsApi, uploadApi, QuestionWithContest, Category, Contest } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import MultiCountrySelect from '@/components/MultiCountrySelect';
import * as XLSX from 'xlsx';
import './question-bank.css';

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionWithContest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithContest | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    categoryId: '',
    contestId: '',
    type: '',
    country: '',
    search: '',
  });

  // Form data
  const [formData, setFormData] = useState({
    categoryId: '',
    contestId: '',
    question: '',
    type: 'NONE' as 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO',
    media: '',
    level: '',
    countries: ['ALL'] as string[],
    options: ['', '', '', ''],
    correctOption: '',
  });
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [importedQuestions, setImportedQuestions] = useState<any[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCategories();
    fetchContests();
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchCategories = async () => {
    try {
      const data = await categoriesApi.getAll();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchContests = async () => {
    try {
      const data = await contestsApi.getAll({ all: 'true' });
      setContests(data.data);
    } catch (err) {
      console.error('Error fetching contests:', err);
    }
  };

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await questionsApi.getAll({
        categoryId: filters.categoryId || undefined,
        contestId: filters.contestId || undefined,
        type: filters.type || undefined,
        country: filters.country || undefined,
        search: filters.search || undefined,
      });
      setQuestions(response.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to fetch questions');
      console.error(err);
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
        await questionsApi.delete(id);
      }
      setSelectedIds(new Set());
      fetchQuestions();
    } catch (err) {
      setError('Failed to delete selected questions');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: QuestionWithContest) => {
    setEditingQuestion(question);
    // Parse options - extract text from objects if needed, always ensure strings
    const parsedOptions = question.options.map((opt: any) => {
      if (typeof opt === 'string') {
        return opt;
      }
      // If it's an object, extract the text
      if (opt && typeof opt === 'object') {
        return opt.text || String(opt);
      }
      // Fallback to string conversion
      return String(opt || '');
    });
    
    while (parsedOptions.length < 4) {
      parsedOptions.push('');
    }
    
    // Ensure correctOption is also a string
    let correctOptionText = question.correctOption;
    if (typeof correctOptionText !== 'string') {
      correctOptionText = String(correctOptionText || '');
    }
    
    setFormData({
      categoryId: question.contest?.category?.id || '',
      contestId: question.contestId,
      question: question.question,
      type: question.type,
      media: question.media || '',
      level: '',
      countries: question.countries || ['ALL'],
      options: parsedOptions.slice(0, 4).map(opt => String(opt || '')),
      correctOption: correctOptionText,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }
    try {
      await questionsApi.delete(id);
      fetchQuestions();
    } catch (err) {
      setError('Failed to delete question');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contestId) {
      alert('Please select a contest');
      return;
    }

    if (!formData.question.trim()) {
      alert('Please enter a question');
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
      alert('Please provide at least 2 options');
      return;
    }

    if (!formData.correctOption || !formData.correctOption.trim()) {
      alert('Please select a correct option');
      return;
    }

    try {
      // Ensure all options are strings (handle numbers and single characters)
      const optionsAsStrings = formData.options.map(opt => {
        if (opt === null || opt === undefined) return '';
        if (typeof opt === 'number') return String(opt);
        return String(opt || '');
      });

      const questionData = {
        question: formData.question,
        type: formData.type,
        media: formData.media || undefined,
        options: optionsAsStrings,
        correctOption: String(formData.correctOption || ''),
        countries: formData.countries,
      };

      if (editingQuestion) {
        await questionsApi.update(editingQuestion.id, questionData);
      } else {
        await questionsApi.create(formData.contestId, questionData);
      }
      
      resetForm();
      fetchQuestions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save question');
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const type = formData.type.toLowerCase() as 'categories' | 'contests' | 'questions' | 'funfacts';
      const result = await uploadApi.uploadImage(file, type === 'questions' ? 'questions' : 'contests');
      setFormData({ ...formData, media: result.path });
    } catch (err) {
      setError('Failed to upload media');
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
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
      const removedOption = formData.options[index];
      const removedOptionStr = typeof removedOption === 'string' ? removedOption : String(removedOption || '');
      const currentCorrectOption = typeof formData.correctOption === 'string' ? formData.correctOption : String(formData.correctOption || '');
      setFormData({
        ...formData,
        options: newOptions,
        correctOption: currentCorrectOption === removedOptionStr ? '' : currentCorrectOption,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      categoryId: '',
      contestId: '',
      question: '',
      type: 'NONE',
      media: '',
      level: '',
      countries: ['ALL'],
      options: ['', '', '', ''],
      correctOption: '',
    });
    setEditingQuestion(null);
    setShowForm(false);
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        Question: 'What is the capital of France?',
        Category: 'Geography',
        Contest: 'World Quiz',
        'Media Type': 'NONE',
        'Media Path': '',
        'Option 1': 'London',
        'Option 2': 'Paris',
        'Option 3': 'Berlin',
        'Option 4': 'Madrid',
        'Correct Option': 'Paris',
        Countries: 'ALL',
      },
      {
        Question: 'Which planet is known as the Red Planet?',
        Category: 'Science',
        Contest: 'Science Challenge',
        'Media Type': 'NONE',
        'Media Path': '',
        'Option 1': 'Venus',
        'Option 2': 'Mars',
        'Option 3': 'Jupiter',
        'Option 4': 'Saturn',
        'Correct Option': 'Mars',
        Countries: 'ALL',
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Questions');
    XLSX.writeFile(workbook, 'sample_questions.xlsx');
  };

  const handleExport = () => {
    const data = questions.map((question) => {
      const getOptionText = (opt: any, index: number) => {
        if (typeof opt === 'string') return opt;
        return opt?.text || opt || '';
      };

      return {
        'Question': question.question,
        'Category': question.contest?.category?.name || '',
        'Contest': question.contest?.name || '',
        'Media Type': question.type,
        'Media Path': question.media || '',
        'Option 1': Array.isArray(question.options) && question.options[0] ? getOptionText(question.options[0], 0) : '',
        'Option 2': Array.isArray(question.options) && question.options[1] ? getOptionText(question.options[1], 1) : '',
        'Option 3': Array.isArray(question.options) && question.options[2] ? getOptionText(question.options[2], 2) : '',
        'Option 4': Array.isArray(question.options) && question.options[3] ? getOptionText(question.options[3], 3) : '',
        'Correct Option': question.correctOption,
        'Countries': question.countries?.join(', ') || question.contest?.region || 'ALL',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
    XLSX.writeFile(workbook, `questions_export_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        // Find contest by name or category
        let contestId = '';
        const contestName = row.Contest || row.contest || '';
        const categoryName = row.Category || row.category || '';
        
        if (contestName) {
          const contest = contests.find(c => c.name === contestName);
          if (contest) contestId = contest.id;
        } else if (categoryName) {
          const category = categories.find(c => c.name === categoryName);
          if (category) {
            const contest = contests.find(c => c.categoryId === category.id);
            if (contest) contestId = contest.id;
          }
        }

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
          type: (row['Media Type'] || row.mediaType || row.type || 'NONE').toUpperCase(),
          media: row['Media Path'] || row.mediaPath || row.media || '',
          options: options,
          correctOption: correctOption,
          contestId: contestId,
          contestName: contestName,
          categoryName: categoryName,
        };

        if (questionData.question && questionData.options.length >= 2 && questionData.correctOption) {
          imported.push(questionData);
        }
      }

      if (imported.length > 0) {
        setImportedQuestions(imported);
        setShowImportPreview(true);
      } else {
        alert('No valid questions found in the file. Please check the format.');
      }
    } catch (err) {
      setError('Failed to import questions');
      console.error(err);
    }

    e.target.value = '';
  };

  const downloadFailedQuestionsExcel = (failedRows: { item: any; error: string }[]) => {
    const data = failedRows.map(({ item, error }) => ({
      'Contest ID': item.contestId || '',
      Question: item.question || '',
      'Option 1': (item.options && item.options[0]) || '',
      'Option 2': (item.options && item.options[1]) || '',
      'Option 3': (item.options && item.options[2]) || '',
      'Option 4': (item.options && item.options[3]) || '',
      'Correct Answer': item.correctOption || '',
      Type: item.type || 'NONE',
      Error: error,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed Questions');
    const filename = `question_bank_failed_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleSaveImported = async () => {
    try {
      setLoading(true);
      let successCount = 0;
      const failedRows: { item: any; error: string }[] = [];

      for (const item of importedQuestions) {
        if (!item.contestId) {
          failedRows.push({ item, error: 'Contest ID is required' });
          continue;
        }

        try {
          const optionsAsStrings = (item.options || []).map((o: any) => (o != null ? String(o) : ''));
          const correctOptionStr = item.correctOption != null ? String(item.correctOption) : '';
          if (!correctOptionStr || !optionsAsStrings.includes(correctOptionStr)) {
            failedRows.push({ item, error: 'Correct option must be one of the provided options' });
            continue;
          }
          await questionsApi.create(item.contestId, {
            question: item.question,
            type: item.type,
            media: item.media || undefined,
            options: optionsAsStrings,
            correctOption: correctOptionStr,
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
    <div className="question-bank-page admin-page">
      <div className="admin-page-header page-header">
        <h1>Question Bank</h1>
        <div className="header-actions">
          <button onClick={handleDownloadSample} className="btn-export" title="Download a sample Excel file with the expected format">
            Sample File
          </button>
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
                  <span>Contest: {item.contestName || item.categoryName || 'Not found'}</span>
                  <span>Type: {item.type}</span>
                  <span>Options: {item.options.length}</span>
                </div>
                {!item.contestId && (
                  <div className="preview-error">
                    ⚠️ Contest not found. Please create the contest first or update the contest name.
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="import-actions">
            <button onClick={handleSaveImported} className="btn-save-import" disabled={loading}>
              {loading ? 'Importing...' : `Import ${importedQuestions.filter(q => q.contestId).length} Questions`}
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
            <label>Category</label>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Contest</label>
            <select
              value={filters.contestId}
              onChange={(e) => setFilters({ ...filters, contestId: e.target.value })}
            >
              <option value="">All Contests</option>
              {contests.map((contest) => (
                <option key={contest.id} value={contest.id}>
                  {contest.name}
                </option>
              ))}
            </select>
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
          <div className="filter-group">
            <label>Country</label>
            <select
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
            >
              <option value="">All Countries</option>
              <option value="ALL">All Countries</option>
            </select>
          </div>
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="loading">Loading questions...</div>
      ) : questions.length === 0 ? (
        <div className="no-data">No questions found. Create one to get started!</div>
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
                <th>Category</th>
                <th>Contest</th>
                <th>Type</th>
                <th>Countries</th>
                <th>Options</th>
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
                    {question.media && (
                      <div className="question-media">
                        {question.type === 'IMAGE' && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getImageUrl(question.media)} alt="Question media" className="media-thumbnail" />
                        )}
                        {question.type === 'VIDEO' && <span>🎥 Video</span>}
                        {question.type === 'AUDIO' && <span>🎵 Audio</span>}
                      </div>
                    )}
                  </td>
                  <td>{question.contest?.category?.name || '-'}</td>
                  <td>{question.contest?.name || '-'}</td>
                  <td>
                    <span className={`type-badge type-${question.type.toLowerCase()}`}>
                      {question.type}
                    </span>
                  </td>
                  <td>{question.countries?.join(', ') || question.contest?.region || '-'}</td>
                  <td>
                    <div className="options-preview">
                      {question.options.slice(0, 2).map((opt: any, idx: number) => {
                        const optionText = typeof opt === 'string' ? opt : (opt.text || opt);
                        const isCorrect = typeof opt === 'string' 
                          ? opt === question.correctOption 
                          : (opt.text === question.correctOption || opt === question.correctOption);
                        
                        return (
                          <div key={idx} className={`option-preview ${isCorrect ? 'correct' : ''}`}>
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

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content question-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingQuestion ? 'Edit Contest Question' : 'Create Question'}</h3>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="question-form">
              <div className="form-group">
                <label>Pick a Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => {
                    setFormData({ ...formData, categoryId: e.target.value });
                    // Filter contests by category
                    if (e.target.value) {
                      const filtered = contests.filter(c => c.categoryId === e.target.value);
                      if (filtered.length > 0 && !filtered.find(c => c.id === formData.contestId)) {
                        setFormData(prev => ({ ...prev, contestId: filtered[0].id }));
                      }
                    }
                  }}
                  required
                >
                  <option value="">Choose a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Question</label>
                <textarea
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="Enter the question"
                  rows={3}
                  required
                />
              </div>

              <div className="form-group">
                <label>Pick a Media type</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="mediaType"
                      value="NONE"
                      checked={formData.type === 'NONE'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any, media: '' })}
                    />
                    <span>NONE</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="mediaType"
                      value="IMAGE"
                      checked={formData.type === 'IMAGE'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    />
                    <span>IMAGE</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="mediaType"
                      value="AUDIO"
                      checked={formData.type === 'AUDIO'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    />
                    <span>AUDIO</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="mediaType"
                      value="VIDEO"
                      checked={formData.type === 'VIDEO'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    />
                    <span>VIDEO</span>
                  </label>
                </div>
                {formData.type !== 'NONE' && (
                  <div className="media-upload">
                    <label className="btn-upload">
                      {uploadingMedia ? 'Uploading...' : 'Upload Media'}
                      <input
                        type="file"
                        accept={formData.type === 'IMAGE' ? 'image/*' : formData.type === 'VIDEO' ? 'video/*' : 'audio/*'}
                        onChange={handleMediaUpload}
                        style={{ display: 'none' }}
                        disabled={uploadingMedia}
                      />
                    </label>
                    {formData.media && (
                      <span className="media-path">{formData.media}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Level</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                >
                  <option value="">Choose a level</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>

              <div className="form-group">
                <MultiCountrySelect
                  value={formData.countries}
                  onChange={(countries) => setFormData({ ...formData, countries })}
                  label="Countries"
                />
              </div>

              <div className="form-group">
                <label>Contest *</label>
                <select
                  value={formData.contestId}
                  onChange={(e) => setFormData({ ...formData, contestId: e.target.value })}
                  required
                >
                  <option value="">Choose a contest</option>
                  {contests
                    .filter(c => !formData.categoryId || c.categoryId === formData.categoryId)
                    .filter(c => true)
                    .map((contest) => (
                      <option key={contest.id} value={contest.id}>
                        {contest.name}
                      </option>
                    ))}
                </select>
                {formData.categoryId && contests.filter(c => c.categoryId === formData.categoryId).length === 0 && (
                  <p className="form-hint">No contests found for this category. Please select a different category.</p>
                )}
              </div>

              <div className="form-group">
                <label>Options</label>
                {formData.options.map((option, index) => {
                  // Ensure option is always a string
                  const optionStr = typeof option === 'string' ? option : String(option || '');
                  const optionTrimmed = optionStr.trim();
                  
                  return (
                    <div key={index} className="option-input-row">
                      <input
                        type="text"
                        value={optionStr}
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
                          value={optionStr}
                          checked={formData.correctOption === optionStr}
                          onChange={(e) => setFormData({ ...formData, correctOption: e.target.value })}
                          disabled={!optionTrimmed}
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
                  );
                })}
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

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={!formData.contestId || !formData.question.trim()}>
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

