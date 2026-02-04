'use client';

import { useState, useEffect } from 'react';
import { questionsApi, contestsApi, Question, Contest } from '@/lib/api';
import './questions.css';

export default function QuestionsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [selectedContest, setSelectedContest] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  useEffect(() => {
    loadContests();
  }, []);

  useEffect(() => {
    if (selectedContest) {
      loadQuestions();
    }
  }, [selectedContest]);

  const loadContests = async () => {
    try {
      const data = await contestsApi.getAll();
      setContests(data);
    } catch (error) {
      console.error('Error loading contests:', error);
    }
  };

  const loadQuestions = async () => {
    if (!selectedContest) return;
    setLoading(true);
    try {
      const data = await questionsApi.getByContest(selectedContest);
      setQuestions(data);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const [formData, setFormData] = useState<{
    question: string;
    type: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
    media: string;
    options: string[];
    correctOption: string;
    order: number;
  }>({
    question: '',
    type: 'NONE',
    media: '',
    options: ['', '', '', ''],
    correctOption: '',
    order: questions.length + 1,
  });

  useEffect(() => {
    if (editingQuestion) {
      // Ensure we have 4 options when editing
      const options = Array.isArray(editingQuestion.options)
  ? editingQuestion.options.map((opt: any) =>
      typeof opt === 'string' ? opt : opt.text
    )
  : [];

      while (options.length < 4) {
        options.push('');
      }
      if (options.length > 4) {
        options.splice(4);
      }
      
      setFormData({
        question: editingQuestion.question,
        type: editingQuestion.type,
        media: editingQuestion.media || '',
        options: options,
        correctOption: editingQuestion.correctOption,
        order: editingQuestion.order,
      });
    } else {
      setFormData({
        question: '',
        type: 'NONE',
        media: '',
        options: ['', '', '', ''],
        correctOption: '',
        order: questions.length + 1,
      });
    }
  }, [editingQuestion, questions.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContest) return;

    // Validation
    if (!formData.question.trim()) {
      alert('Please enter a question');
      return;
    }

    // Ensure all options are strings (handle numbers and single characters)
    const validOptions = formData.options
      .map(opt => {
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

    // Ensure we have exactly 4 options (pad with empty strings if needed)
    // Convert all to strings to handle numbers and single characters
    const optionsToSend = formData.options.map(opt => {
      if (opt === null || opt === undefined) return '';
      if (typeof opt === 'number') return String(opt);
      return String(opt || '');
    });
    while (optionsToSend.length < 4) {
      optionsToSend.push('');
    }

    try {
      if (editingQuestion) {
        await questionsApi.update(editingQuestion.id, {
          question: formData.question,
          type: formData.type,
          media: formData.media || undefined,
          options: optionsToSend,
          correctOption: formData.correctOption,
          order: formData.order,
        });
      } else {
        await questionsApi.create(selectedContest, {
          question: formData.question,
          type: formData.type,
          media: formData.media || undefined,
          options: optionsToSend,
          correctOption: formData.correctOption,
          order: formData.order,
        });
      }
      setShowForm(false);
      setEditingQuestion(null);
      loadQuestions();
    } catch (error: any) {
      console.error('Error saving question:', error);
      alert(error.response?.data?.error || 'Failed to save question');
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleCorrectOptionChange = (value: string) => {
    setFormData({ ...formData, correctOption: value });
  };

  return (
    <div className="questions-page">
      <div className="page-header">
        <h2>Manage Questions</h2>
        <div className="header-actions">
          <select
            value={selectedContest}
            onChange={(e) => setSelectedContest(e.target.value)}
            className="contest-select"
          >
            <option value="">Select a Contest</option>
            {contests.map((contest) => (
              <option key={contest.id} value={contest.id}>
                {contest.name}
              </option>
            ))}
          </select>
          {selectedContest && (
            <button
              onClick={() => {
                setEditingQuestion(null);
                setShowForm(true);
              }}
              className="btn-primary"
            >
              Add Question
            </button>
          )}
        </div>
      </div>

      {selectedContest && (
        <div className="questions-content">
          {loading ? (
            <p>Loading questions...</p>
          ) : questions.length === 0 ? (
            <div className="empty-state">
              <p>No questions found for this contest.</p>
              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setShowForm(true);
                }}
                className="btn-primary"
              >
                Add First Question
              </button>
            </div>
          ) : (
            <div className="questions-list">
              {questions.map((question, index) => (
                <div key={question.id} className="question-card">
                  <div className="question-header">
                    <span className="question-number">Q{index + 1}</span>
                    <div className="question-actions">
                      <button
                        onClick={() => {
                          setEditingQuestion(question);
                          setShowForm(true);
                        }}
                        className="btn-edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this question?')) {
                            try {
                              await questionsApi.delete(question.id);
                              loadQuestions();
                            } catch (error) {
                              alert('Error deleting question');
                            }
                          }
                        }}
                        className="btn-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="question-text">{question.question}</p>
                  <div className="question-options">
                    {question.options.map((option, optIndex) => (
                      <div
                        key={optIndex}
                        className={`option ${option === question.correctOption ? 'correct' : ''}`}
                      >
                        {String.fromCharCode(65 + optIndex)}. {typeof option === 'string' ? option : option.text}

                        {option === question.correctOption && (
                          <span className="correct-badge">✓ Correct</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedContest && (
        <div className="empty-state">
          <p>Please select a contest to manage questions</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => {
          setShowForm(false);
          setEditingQuestion(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingQuestion ? 'Edit Question' : 'Add Question'}</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowForm(false);
                  setEditingQuestion(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="question-form">
              <div className="form-group">
                <label>Question Text *</label>
                <textarea
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="Enter the question"
                  rows={3}
                  required
                />
              </div>

              <div className="form-group">
                <label>Question Type</label>
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
                  <label>Media URL</label>
                  <input
                    type="text"
                    value={formData.media}
                    onChange={(e) => setFormData({ ...formData, media: e.target.value })}
                    placeholder="Enter media URL or path"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Options * (at least 2 required)</label>
                {formData.options.map((option, index) => (
                  <div key={index} className="option-input-group">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className={formData.correctOption === option ? 'correct-option' : ''}
                    />
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="correctOption"
                        value={option}
                        checked={formData.correctOption === option}
                        onChange={(e) => handleCorrectOptionChange(e.target.value)}
                        disabled={!option.trim()}
                      />
                      Correct
                    </label>
                  </div>
                ))}
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
                <button type="button" className="btn-cancel" onClick={() => {
                  setShowForm(false);
                  setEditingQuestion(null);
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingQuestion ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

