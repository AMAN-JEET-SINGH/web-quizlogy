'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { funfactsApi, CreateFunFactData } from '@/lib/api';
import '../funfacts.css';

export default function AddFunFactPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CreateFunFactData>({
    title: '',
    description: '',
    imagePath: '',
    status: 'ACTIVE',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await funfactsApi.create(formData);
      router.push('/dashboard/funfacts');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create fun fact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="funfacts-page">
      <div className="page-header">
        <h2>Add Fun Fact</h2>
        <button
          onClick={() => router.push('/dashboard/funfacts')}
          className="btn-cancel"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="funfact-form">
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter fun fact title"
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter fun fact description"
            rows={4}
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

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => router.push('/dashboard/funfacts')}
          >
            Cancel
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Fun Fact'}
          </button>
        </div>
      </form>
    </div>
  );
}













