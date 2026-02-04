'use client';

import { useState, useEffect } from 'react';
import { battlesApi, BattleQuestion, CreateBattleQuestionData, uploadApi } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import './questions.css';

export default function BattleQuestionsPage() {
  const router = useRouter();
  const params = useParams();
  const battleId = params?.id as string;

  const [battle, setBattle] = useState<any>(null);
  const [questions, setQuestions] = useState<BattleQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<BattleQuestion | null>(null);
  const [formData, setFormData] = useState<CreateBattleQuestionData>({
    category: '',
    question: '',
    type: 'NONE',
    media: '',
    options: ['', '', '', ''],
    correctOption: '',
    order: 1,
  });
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (battleId) {
      fetchBattle();
      fetchQuestions();
    }
  }, [battleId]);

  // Get unique categories from questions
  const categories = Array.from(new Set(questions.map(q => q.category).filter(Boolean)));
  
  // Include selectedCategory in categories list if it's not already there
  const allCategories = selectedCategory && !categories.includes(selectedCategory) 
    ? [...categories, selectedCategory] 
    : categories;

  // Handle adding question with pre-filled category
  const handleAddQuestionForCategory = (category: string) => {
    setSelectedCategory(category);
    setFormData({
      category: category,
      question: '',
      type: 'NONE',
      media: '',
      options: ['', '', '', ''],
      correctOption: '',
      order: questions.length + 1,
    });
    setShowForm(true);
    setEditingQuestion(null);
  };

  // Handle category selection change
  const handleCategoryChange = (value: string) => {
    if (value === '__NEW__') {
      setFormData({ ...formData, category: '' });
    } else {
      setFormData({ ...formData, category: value });
      setSelectedCategory(value);
    }
  };

  const fetchBattle = async () => {
    try {
      const data = await battlesApi.getById(battleId);
      setBattle(data);
    } catch (err) {
      setError('Failed to fetch battle');
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await battlesApi.getQuestions(battleId);
      // Parse options if they're JSON strings
      const parsedQuestions = data.map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      }));
      setQuestions(parsedQuestions);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load questions';
      setError(errorMessage);
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

    if (!formData.category.trim() || formData.category === '__NEW__') {
      setError('Please select or enter a battle');
      return;
    }

    const validOptions = formData.options.filter(opt => opt.trim().length > 0);
    if (validOptions.length < 2) {
      setError('Please provide at least 2 options');
      return;
    }

    if (!formData.correctOption || !formData.correctOption.trim()) {
      setError('Please select a correct option');
      return;
    }

    if (!validOptions.includes(formData.correctOption)) {
      setError('Correct option must be one of the provided options');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const questionPayload: CreateBattleQuestionData = {
        category: formData.category,
        question: formData.question,
        type: formData.type,
        media: formData.media || undefined,
        options: validOptions,
        correctOption: formData.correctOption,
        order: formData.order,
      };

      if (editingQuestion) {
        await battlesApi.updateQuestion(battleId, editingQuestion.id, questionPayload);
      } else {
        await battlesApi.createQuestion(battleId, questionPayload);
      }
      resetForm();
      fetchQuestions();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save question';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: BattleQuestion) => {
    setEditingQuestion(question);
    const parsedOptions = Array.isArray(question.options)
      ? question.options
      : typeof question.options === 'string'
      ? JSON.parse(question.options)
      : ['', '', '', ''];

    while (parsedOptions.length < 4) {
      parsedOptions.push('');
    }

    setFormData({
      category: question.category,
      question: question.question,
      type: question.type,
      media: question.media || '',
      options: parsedOptions.slice(0, 4),
      correctOption: question.correctOption,
      order: question.order,
    });
    setShowForm(true);
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
        await battlesApi.deleteQuestion(battleId, id);
      }
      setSelectedIds(new Set());
      fetchQuestions();
    } catch (err) {
      setError('Failed to delete selected questions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }
    try {
      await battlesApi.deleteQuestion(battleId, questionId);
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
      category: '',
      question: '',
      type: 'NONE',
      media: '',
      options: ['', '', '', ''],
      correctOption: '',
      order: questions.length + 1,
    });
    setEditingQuestion(null);
    setSelectedCategory(null);
    setShowForm(false);
  };

  // Update categories when questions change
  useEffect(() => {
    // This will trigger re-render when questions change
  }, [questions]);

  const downloadFailedExcel = (failedRows: { row: any; error: string }[]) => {
    const data = failedRows.map(({ row, error }) => ({
      Category: row.category || row.Category || '',
      Question: row.question || row.Question || '',
      'Option 1': row.option1 || row.Option1 || row['Option 1'] || '',
      'Option 2': row.option2 || row.Option2 || row['Option 2'] || '',
      'Option 3': row.option3 || row.Option3 || row['Option 3'] || '',
      'Option 4': row.option4 || row.Option4 || row['Option 4'] || '',
      'Correct Option': row.correctOption || row['Correct Option'] || row.correct || '',
      Type: row.type || row.Type || 'NONE',
      Order: row.order ?? row.Order ?? '',
      Error: error,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed Questions');
    XLSX.writeFile(workbook, `battle_questions_failed_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      setLoading(true);
      setError(null);
      let successCount = 0;
      const failedRows: { row: any; error: string }[] = [];

      for (const row of jsonData as any[]) {
        const category = row.category || row.Category || '';
        const question = row.question || row.Question || '';
        const option1 = row.option1 || row.Option1 || row['Option 1'] || '';
        const option2 = row.option2 || row.Option2 || row['Option 2'] || '';
        const option3 = row.option3 || row.Option3 || row['Option 3'] || '';
        const option4 = row.option4 || row.Option4 || row['Option 4'] || '';
        const correctOption = row.correctOption || row['Correct Option'] || row.correct || '';
        const order = parseInt(row.order || row.Order || questions.length + successCount + 1);
        const type = (row.type || row.Type || 'NONE').toUpperCase();
        const media = row.media || row.Media || '';

        const optionsAsStrings = [option1, option2, option3, option4]
          .map(opt => (opt != null ? String(opt) : ''))
          .filter(opt => opt.trim() !== '');
        const correctOptionStr = correctOption != null ? String(correctOption) : '';

        if (!category || !question || !correctOptionStr) {
          failedRows.push({ row, error: 'Category, question and correct option are required' });
          continue;
        }
        if (optionsAsStrings.length < 2) {
          failedRows.push({ row, error: 'At least 2 options are required' });
          continue;
        }
        if (!optionsAsStrings.includes(correctOptionStr)) {
          failedRows.push({ row, error: 'Correct option must be one of the provided options' });
          continue;
        }

        try {
          const optionsPadded = [...optionsAsStrings];
          while (optionsPadded.length < 4) optionsPadded.push('');
          const questionPayload: CreateBattleQuestionData = {
            category,
            question,
            type: type as 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO',
            media: media || undefined,
            options: optionsPadded.slice(0, 4),
            correctOption: correctOptionStr,
            order,
          };
          await battlesApi.createQuestion(battleId, questionPayload);
          successCount++;
        } catch (err: any) {
          const errorMessage = err?.response?.data?.error || err?.message || 'Unknown error';
          failedRows.push({ row, error: String(errorMessage) });
        }
      }

      if (failedRows.length > 0) {
        downloadFailedExcel(failedRows);
      }
      await fetchQuestions();
      if (failedRows.length > 0) {
        alert(`Import completed! ${successCount} imported. ${failedRows.length} failed — failed rows downloaded as Excel.`);
      } else {
        alert('Questions imported successfully!');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to import questions');
      console.error(err);
    } finally {
      setLoading(false);
    }

    e.target.value = '';
  };

  const handleExport = () => {
    const data = questions.map((q) => {
      const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options);
      return {
        Order: q.order,
        Category: q.category,
        Question: q.question,
        Type: q.type,
        Media: q.media || '',
        'Option 1': options[0] || '',
        'Option 2': options[1] || '',
        'Option 3': options[2] || '',
        'Option 4': options[3] || '',
        'Correct Option': q.correctOption,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Battle Questions');
    XLSX.writeFile(workbook, `battle-questions-${battle?.name || 'export'}.xlsx`);
  };

  return (
    <div className="battle-questions-page">
      <div className="page-header">
        <div>
          <Link href="/dashboard/battles" className="back-link">
            ← Back to Battles
          </Link>
          <h1>{battle?.name || 'Battle'} - Questions</h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowForm(!showForm)} className="btn-add-new">
            <span className="btn-icon">➕</span>
            <span>{showForm ? 'Cancel' : 'Add Question'}</span>
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

      {/* Battle Category Section - Always visible */}
      <div className="categories-section">
        <h3>Battle Category</h3>
        <div className="categories-list">
          <div className="battle-category-display">
            <span className="battle-category-name">{battle?.name || 'Loading...'}</span>
            <span className="battle-category-count">{questions.length} Questions</span>
          </div>
        </div>
        {categories.length > 0 && (
          <>
            <h4 style={{ marginTop: '20px', marginBottom: '12px', fontSize: '16px', color: '#666' }}>Question Categories</h4>
            <div className="categories-list">
              {allCategories.map((category) => {
                const categoryQuestions = questions.filter(q => q.category === category);
                return (
                  <button
                    key={category}
                    onClick={() => handleAddQuestionForCategory(category)}
                    className="category-badge"
                    title={`Click to add question to ${category} (${categoryQuestions.length} questions)`}
                  >
                    <span className="category-name">{category}</span>
                    <span className="category-count">{categoryQuestions.length}</span>
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setFormData({
                    category: '__NEW__',
                    question: '',
                    type: 'NONE',
                    media: '',
                    options: ['', '', '', ''],
                    correctOption: '',
                    order: questions.length + 1,
                  });
                  setShowForm(true);
                  setEditingQuestion(null);
                }}
                className="category-badge category-badge-new"
                title="Add question to a new category"
              >
                <span className="category-name">+ New Category</span>
              </button>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
        <div className="modal-content question-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingQuestion ? 'Edit Battle Question' : 'Create Battle Question'}</h3>
          <button type="button" className="close-btn" onClick={resetForm}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="category-form modal-form">
          <h3>{editingQuestion ? 'Edit Question' : 'Create New Question'}</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Battle *</label>
                <div className="category-select-wrapper">
                  <select
                    value={formData.category === '__NEW__' ? '' : (allCategories.includes(formData.category) ? formData.category : '')}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    required={!formData.category || formData.category === '__NEW__'}
                    className={selectedCategory ? 'category-prefilled' : ''}
                  >
                    <option value="">Select a battle</option>
                    {allCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value="__NEW__">+ Add New Battle</option>
                  </select>
                  {(formData.category === '__NEW__' || (formData.category && formData.category !== '' && !allCategories.includes(formData.category))) && (
                    <input
                      type="text"
                      value={formData.category === '__NEW__' ? '' : formData.category}
                      onChange={(e) => {
                        const newCategory = e.target.value;
                        setFormData({ ...formData, category: newCategory });
                        setSelectedCategory(null);
                      }}
                      placeholder="Enter new battle name"
                      className="category-new-input"
                      autoFocus={formData.category === '__NEW__'}
                      required
                    />
                  )}
                </div>
                {selectedCategory && (
                  <div className="category-hint">
                    Battle selected: <strong>{selectedCategory}</strong>
                  </div>
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
            </div>

            <div className="form-group">
              <label>Question *</label>
              <textarea
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                required
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <option value="NONE">None</option>
                  <option value="IMAGE">Image</option>
                  <option value="VIDEO">Video</option>
                  <option value="AUDIO">Audio</option>
                </select>
              </div>
              {formData.type !== 'NONE' && (
                <div className="form-group">
                  <label>Media</label>
                  <input
                    type="file"
                    accept={formData.type === 'IMAGE' ? 'image/*' : formData.type === 'VIDEO' ? 'video/*' : 'audio/*'}
                    onChange={handleMediaUpload}
                    disabled={uploadingMedia}
                  />
                  {formData.media && (
                    <div className="media-preview">
                      {formData.type === 'IMAGE' && (
                        <img src={getImageUrl(formData.media)} alt="Preview" />
                      )}
                      <span>{formData.media}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Options * (at least 2 required)</label>
              {formData.options.map((option, index) => (
                <div key={index} className="option-input">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...formData.options];
                      newOptions[index] = e.target.value;
                      setFormData({ ...formData, options: newOptions });
                    }}
                    placeholder={`Option ${index + 1}`}
                  />
                  <input
                    type="radio"
                    name="correctOption"
                    checked={formData.correctOption === option}
                    onChange={() => setFormData({ ...formData, correctOption: option })}
                    disabled={!option.trim()}
                  />
                  <label>Correct</label>
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button type="button" onClick={resetForm} className="btn-cancel">
                Cancel
              </button>
              <button type="submit" className="btn-save" disabled={loading}>
                {loading ? 'Saving...' : editingQuestion ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
        </div>
      )}

      {loading && !showForm ? (
        <div className="loading">Loading questions...</div>
      ) : (
        <div className="questions-table-container">
          {questions.length === 0 ? (
            <div className="no-data">
              <p>No questions found. Add your first question!</p>
            </div>
          ) : (
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
                  <th>Order</th>
                  <th>Category</th>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Options</th>
                  <th>Correct Answer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions
                  .sort((a, b) => a.order - b.order)
                  .map((question) => (
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
                      <td className="text-center">{question.order}</td>
                      <td>
                        <span className="question-category">{question.category}</span>
                      </td>
                      <td className="question-text-cell">
                        <div className="question-text">{question.question}</div>
                        {question.media && question.type !== 'NONE' && (
                          <div className="question-media-small">
                            {question.type === 'IMAGE' && (
                              <img src={getImageUrl(question.media)} alt="Question media" />
                            )}
                            <span className="media-type-badge">{question.type}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`type-badge ${question.type.toLowerCase()}`}>
                          {question.type}
                        </span>
                      </td>
                      <td className="options-cell">
                        {Array.isArray(question.options)
                          ? question.options.map((opt, idx) => (
                              <div key={idx} className="option-item">
                                {opt}
                              </div>
                            ))
                          : null}
                      </td>
                      <td>
                        <span className="correct-answer">
                          {question.correctOption} ✓
                        </span>
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
          )}
        </div>
      )}
    </div>
  );
}
