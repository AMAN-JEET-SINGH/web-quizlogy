'use client';

import { useState, useEffect } from 'react';
import { wheelApi } from '@/lib/api';

interface Prize {
  label: string;
  value: number;
  probability: number;
  color?: string;
}

interface Wheel {
  id: string;
  name: string;
  isActive: boolean;
  spinCost: number;
  prizes: Prize[];
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80', '#EC7063', '#5DADE2'
];

export default function WheelManagement() {
  const [wheels, setWheels] = useState<Wheel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingWheel, setEditingWheel] = useState<Wheel | null>(null);
  const [formData, setFormData] = useState({
    name: 'Spin Wheel',
    isActive: true,
    spinCost: 10,
    prizes: [
      { label: '10', value: 10, probability: 0.3, color: DEFAULT_COLORS[0] },
      { label: '20', value: 20, probability: 0.25, color: DEFAULT_COLORS[1] },
      { label: '50', value: 50, probability: 0.2, color: DEFAULT_COLORS[2] },
      { label: '100', value: 100, probability: 0.15, color: DEFAULT_COLORS[3] },
      { label: '200', value: 200, probability: 0.08, color: DEFAULT_COLORS[4] },
      { label: '500', value: 500, probability: 0.02, color: DEFAULT_COLORS[5] },
    ] as Prize[],
  });

  useEffect(() => {
    fetchWheels();
  }, []);

  const fetchWheels = async () => {
    try {
      setLoading(true);
      const response = await wheelApi.getAll();
      setWheels(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch wheels');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate probabilities sum to 1
      const totalProb = formData.prizes.reduce((sum, p) => sum + p.probability, 0);
      if (Math.abs(totalProb - 1) > 0.01) {
        alert(`Probabilities must sum to 1. Current sum: ${totalProb.toFixed(2)}`);
        return;
      }

      if (editingWheel) {
        await wheelApi.update(editingWheel.id, formData);
      } else {
        await wheelApi.create(formData);
      }
      resetForm();
      fetchWheels();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save wheel');
    }
  };

  const handleEdit = (wheel: Wheel) => {
    setEditingWheel(wheel);
    setFormData({
      name: wheel.name,
      isActive: wheel.isActive,
      spinCost: wheel.spinCost,
      prizes: wheel.prizes.map(p => ({
        ...p,
        color: p.color || DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      })),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this wheel?')) {
      return;
    }
    try {
      await wheelApi.delete(id);
      fetchWheels();
    } catch (err) {
      setError('Failed to delete wheel');
    }
  };

  const resetForm = () => {
    setFormData({
      name: 'Spin Wheel',
      isActive: true,
      spinCost: 10,
      prizes: [
        { label: '10', value: 10, probability: 0.3, color: DEFAULT_COLORS[0] },
        { label: '20', value: 20, probability: 0.25, color: DEFAULT_COLORS[1] },
        { label: '50', value: 50, probability: 0.2, color: DEFAULT_COLORS[2] },
        { label: '100', value: 100, probability: 0.15, color: DEFAULT_COLORS[3] },
        { label: '200', value: 200, probability: 0.08, color: DEFAULT_COLORS[4] },
        { label: '500', value: 500, probability: 0.02, color: DEFAULT_COLORS[5] },
      ],
    });
    setEditingWheel(null);
    setShowForm(false);
  };

  const addPrize = () => {
    setFormData({
      ...formData,
      prizes: [
        ...formData.prizes,
        {
          label: '0',
          value: 0,
          probability: 0,
          color: DEFAULT_COLORS[formData.prizes.length % DEFAULT_COLORS.length],
        },
      ],
    });
  };

  const removePrize = (index: number) => {
    setFormData({
      ...formData,
      prizes: formData.prizes.filter((_, i) => i !== index),
    });
  };

  const updatePrize = (index: number, field: keyof Prize, value: any) => {
    const newPrizes = [...formData.prizes];
    newPrizes[index] = { ...newPrizes[index], [field]: value };
    setFormData({ ...formData, prizes: newPrizes });
  };

  const normalizeProbabilities = () => {
    const total = formData.prizes.reduce((sum, p) => sum + p.probability, 0);
    if (total > 0) {
      const normalized = formData.prizes.map(p => ({
        ...p,
        probability: p.probability / total,
      }));
      setFormData({ ...formData, prizes: normalized });
    }
  };

  const totalProbability = formData.prizes.reduce((sum, p) => sum + p.probability, 0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Wheel Management</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Create New Wheel
        </button>
      </div>

      {error && (
        <div className="bg-red-500 text-white p-4 rounded mb-4">{error}</div>
      )}

      {showForm && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">
            {editingWheel ? 'Edit Wheel' : 'Create New Wheel'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-white mb-2">Wheel Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 rounded bg-gray-700 text-white"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-white mb-2">Spin Cost (Coins)</label>
              <input
                type="number"
                value={formData.spinCost}
                onChange={(e) => setFormData({ ...formData, spinCost: parseInt(e.target.value) || 10 })}
                className="w-full p-2 rounded bg-gray-700 text-white"
                min="1"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-white mb-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                Active (Only one active wheel allowed)
              </label>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-white">Prizes</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={normalizeProbabilities}
                    className="bg-gray-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Normalize Probabilities
                  </button>
                  <button
                    type="button"
                    onClick={addPrize}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Add Prize
                  </button>
                </div>
              </div>
              <div className="text-yellow-400 text-sm mb-2">
                Total Probability: {totalProbability.toFixed(2)} (should be 1.00)
              </div>
              <div className="space-y-2">
                {formData.prizes.map((prize, index) => (
                  <div key={index} className="flex gap-2 items-center bg-gray-700 p-2 rounded">
                    <input
                      type="text"
                      placeholder="Label"
                      value={prize.label}
                      onChange={(e) => updatePrize(index, 'label', e.target.value)}
                      className="flex-1 p-2 rounded bg-gray-600 text-white"
                    />
                    <input
                      type="number"
                      placeholder="Value"
                      value={prize.value}
                      onChange={(e) => updatePrize(index, 'value', parseInt(e.target.value) || 0)}
                      className="w-24 p-2 rounded bg-gray-600 text-white"
                      min="0"
                    />
                    <input
                      type="number"
                      placeholder="Probability"
                      value={prize.probability}
                      onChange={(e) => updatePrize(index, 'probability', parseFloat(e.target.value) || 0)}
                      className="w-32 p-2 rounded bg-gray-600 text-white"
                      min="0"
                      max="1"
                      step="0.01"
                    />
                    <input
                      type="color"
                      value={prize.color || DEFAULT_COLORS[0]}
                      onChange={(e) => updatePrize(index, 'color', e.target.value)}
                      className="w-16 h-10 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removePrize(index)}
                      className="bg-red-500 text-white px-3 py-1 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                {editingWheel ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-white">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wheels.map((wheel) => (
            <div key={wheel.id} className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{wheel.name}</h3>
                  <p className="text-gray-400">
                    {wheel.isActive ? (
                      <span className="text-green-400">Active</span>
                    ) : (
                      <span className="text-gray-500">Inactive</span>
                    )}
                  </p>
                  <p className="text-gray-400">Cost: {wheel.spinCost} coins</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(wheel)}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(wheel.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {wheel.prizes.map((prize, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center text-white"
                    style={{ borderLeft: `4px solid ${prize.color || '#FF6B6B'}` }}
                  >
                    <span className="pl-2">{prize.label} coins</span>
                    <span className="text-gray-400">{(prize.probability * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

