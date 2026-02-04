'use client';

import { useEffect, useState } from 'react';
import { contestsApi, Contest } from '@/lib/api';
import { QuizCard } from './QuizCard';

interface SeeAllContestsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SeeAllContests = ({ isOpen, onClose }: SeeAllContestsProps) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchAllContests();
    }
  }, [isOpen, selectedCategory]);

  const fetchAllContests = async () => {
    try {
      setLoading(true);
      const params = selectedCategory ? { category: selectedCategory } : {};
      const response = await contestsApi.getList(params);
      setContests(response.data || []);
      setCategories(response.categories || []);
    } catch (err) {
      console.error('Error fetching contests:', err);
      setError('Failed to load contests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (contestId: string) => {
    // Navigate to contest details or start quiz
    console.log('Clicked contest:', contestId);
    // You can add navigation logic here
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-5 z-50 overflow-y-auto">
      <div className="bg-[#2C2159] rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white text-2xl font-bold">All Contests</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 text-3xl font-light leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === ''
                    ? 'bg-[#5946A9] text-white'
                    : 'bg-[#392C6E] text-gray-300 hover:bg-[#5946A9]'
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-[#5946A9] text-white'
                      : 'bg-[#392C6E] text-gray-300 hover:bg-[#5946A9]'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center text-white py-12">
            <div className="text-lg">Loading contests...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center text-red-400 py-12">
            <div className="text-lg">{error}</div>
          </div>
        )}

        {/* Contests Grid */}
        {!loading && !error && (
          <>
            {contests.length === 0 ? (
              <div className="text-center text-white py-12">
                <div className="text-lg">No contests available</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {contests.map((contest) => (
                  <QuizCard
                    key={contest.id}
                    id={contest.id}
                    name={contest.name}
                    contestImage={contest.contestImage}
                    category={contest.category}
                    onCardClick={() => handleCardClick(contest.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

