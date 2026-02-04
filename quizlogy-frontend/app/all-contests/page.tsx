'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { ContestCard } from '@/components/ContestCard';
import { SEOHead } from '@/components/SEOHead';
import { contestsApi, Contest, categoriesApi, Category } from '@/lib/api';
import { isDailyContest, isDailyContestLive, getNextDailyStartTime } from '@/lib/dailyContestUtils';

// IDs to exclude from display
const EXCLUDED_CONTEST_IDS = [
  '4c5438fb-f4f6-4df2-933a-04b2250042a7',
  'fc5acfc2-48ab-4eb5-b353-de52d24f779f',
  '06ce1f02-a720-4490-a518-3edf22a9ec69',
  '1ed48531-8d98-4743-b4e9-09b26b3761fa',
  'f2602af1-8fa6-4f96-8abe-806a22b90ed8',
  '751c1eb5-db7c-49a2-9036-0bb1f2e00df6',
];

// Helper function to safely parse date string
const safeParseDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString || typeof dateString !== 'string') return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

// Helper function to check if contest has valid dates
const hasValidDates = (contest: Contest): boolean => {
  if (isDailyContest(contest)) return false; // Daily contests don't use dates
  const startDate = safeParseDate(contest.startDate);
  const endDate = safeParseDate(contest.endDate);
  return startDate !== null && endDate !== null;
};

// Helper function to get contest status for regular contests
const getRegularContestStatus = (contest: Contest, now: Date): 'active' | 'upcoming' | 'past' => {
  const startDate = safeParseDate(contest.startDate);
  const endDate = safeParseDate(contest.endDate);
  
  if (!startDate || !endDate) return 'past';
  
  if (now >= startDate && now <= endDate) return 'active';
  if (now < startDate) return 'upcoming';
  return 'past';
};

// Sort contests: Live Daily (highest priority) > Active > Upcoming Daily > Upcoming > Past Daily > Past
const sortContests = (contests: Contest[]): Contest[] => {
  const now = new Date();

  const liveDaily: Contest[] = [];
  const active: Contest[] = [];
  const upcomingDaily: Contest[] = [];
  const upcoming: Contest[] = [];
  const pastDaily: Contest[] = [];
  const past: Contest[] = [];

  contests.forEach((contest) => {
    // Handle daily contests
    if (isDailyContest(contest)) {
      const isLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
      
      if (isLive) {
        liveDaily.push(contest);
      } else {
        // Check if it's past today's end time
        const dailyEndTime = contest.dailyEndTime || '23:59';
        const [endHours, endMinutes] = dailyEndTime.split(':').map(Number);
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTotalMinutes = currentHours * 60 + currentMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        if (currentTotalMinutes >= endTotalMinutes) {
          pastDaily.push(contest);
        } else {
          upcomingDaily.push(contest);
        }
      }
      return; // Skip rest of loop for daily contests
    }

    // Handle regular contests - only process if not daily
    if (!hasValidDates(contest)) {
      past.push(contest);
      return;
    }

    const status = getRegularContestStatus(contest, now);
    
    switch (status) {
      case 'active':
        active.push(contest);
        break;
      case 'upcoming':
        upcoming.push(contest);
        break;
      case 'past':
        past.push(contest);
        break;
    }
  });

  // Sort active by end date (ascending - ending soon first)
  active.sort((a, b) => {
    const aEnd = safeParseDate(a.endDate);
    const bEnd = safeParseDate(b.endDate);
    if (!aEnd || !bEnd) return 0;
    return aEnd.getTime() - bEnd.getTime();
  });

  // Sort upcoming by start date (ascending - starting soon first)
  upcoming.sort((a, b) => {
    const aStart = safeParseDate(a.startDate);
    const bStart = safeParseDate(b.startDate);
    if (!aStart || !bStart) return 0;
    return aStart.getTime() - bStart.getTime();
  });

  // Sort past by end date (descending - most recent first)
  past.sort((a, b) => {
    const aEnd = safeParseDate(a.endDate);
    const bEnd = safeParseDate(b.endDate);
    if (!aEnd || !bEnd) return 0;
    return bEnd.getTime() - aEnd.getTime();
  });

  return [...liveDaily, ...active, ...upcomingDaily, ...upcoming, ...pastDaily, ...past];
};

export default function AllContestsPage() {
  const router = useRouter();
  const [allContests, setAllContests] = useState<Contest[]>([]);
  const [filteredContests, setFilteredContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>(''); // 'active', 'upcoming', 'past', ''
  const [priceRange, setPriceRange] = useState<string>(''); // 'free', 'low', 'medium', 'high', ''
  
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  
  // Helper function to check if a string is a UUID
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };
  
  // Get unique category names from both sources, filtering out UUIDs
  const availableCategories = Array.from(
    new Set([
      ...categories.filter(cat => !isUUID(cat) && cat.trim() !== ''), // Filter out UUIDs and empty strings
      ...categoryList.map(cat => cat.name).filter(name => name && !isUUID(name) && name.trim() !== '')
    ])
  ).sort();

  useEffect(() => {
    fetchAllContests();
    fetchCategories();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allContests, searchQuery, selectedCategory, selectedStatus, priceRange, categoryList]);

  const fetchAllContests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await contestsApi.getList();
      
      // Filter out excluded contest IDs
      const allContests = (response.data || []).filter(
        contest => !EXCLUDED_CONTEST_IDS.includes(contest.id)
      );
      
      const sortedContests = sortContests(allContests);
      setAllContests(sortedContests);
      setCategories(response.categories || []);
    } catch (err) {
      console.error('Error fetching contests:', err);
      setError('Failed to load contests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await categoriesApi.getAll();
      setCategoryList(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...allContests];

    // Filter by search query (contest name)
    if (searchQuery) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(contest => {
        const contestName = contest.name.toLowerCase();
        return contestName.includes(query);
      });
    }

    // Filter by category
    if (selectedCategory) {
      // Create a mapping from category ID to category name, and also include categories from response
      const categoryIdToName = new Map<string, string>();
      const categoryNameToName = new Map<string, string>();
      
      // Map from categoryList (has id and name)
      categoryList.forEach(cat => {
        if (cat.id && cat.name) {
          categoryIdToName.set(cat.id.toLowerCase().trim(), cat.name.toLowerCase().trim());
          categoryNameToName.set(cat.name.toLowerCase().trim(), cat.name.toLowerCase().trim());
        }
      });
      
      // Also map from categories array (just names)
      categories.forEach(cat => {
        if (cat && !isUUID(cat) && cat.trim() !== '') {
          categoryNameToName.set(cat.toLowerCase().trim(), cat.toLowerCase().trim());
        }
      });
      
      const selectedCategoryLower = String(selectedCategory).trim().toLowerCase();
      
      // Debug logging
      console.log('Filtering by category:', selectedCategory);
      console.log('Available categories:', availableCategories);
      console.log('Category mappings:', Array.from(categoryIdToName.entries()));
      console.log('Total contests before filter:', filtered.length);
      
      filtered = filtered.filter(contest => {
        if (!contest.category) {
          console.log('Contest has no category:', contest.name);
          return false;
        }
        
        const contestCategory = String(contest.category).trim();
        const contestCategoryLower = contestCategory.toLowerCase();
        
        // Check if contest.category matches selectedCategory directly (case-insensitive)
        if (contestCategoryLower === selectedCategoryLower) {
          console.log('Direct match:', contest.name, contestCategory);
          return true;
        }
        
        // Check if contest.category is an ID and map it to name
        const mappedNameFromId = categoryIdToName.get(contestCategoryLower);
        if (mappedNameFromId && mappedNameFromId === selectedCategoryLower) {
          console.log('ID match:', contest.name, contestCategory, '->', mappedNameFromId);
          return true;
        }
        
        // Check if contest.category is a name (already mapped)
        const mappedName = categoryNameToName.get(contestCategoryLower);
        if (mappedName && mappedName === selectedCategoryLower) {
          console.log('Name match:', contest.name, contestCategory);
          return true;
        }
        
        console.log('No match:', contest.name, 'category:', contestCategory);
        return false;
      });
      
      console.log('Total contests after filter:', filtered.length);
    }

    // Filter by status (activeness)
    if (selectedStatus) {
      const now = new Date();
      filtered = filtered.filter(contest => {
        if (isDailyContest(contest)) {
          const isLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
          if (selectedStatus === 'active') {
            return isLive;
          } else if (selectedStatus === 'upcoming') {
            return !isLive;
          } else if (selectedStatus === 'past') {
            return false; // Daily contests are never "past" in the traditional sense
          }
          return true;
        } else {
          // Regular contest - use helper function
          if (!hasValidDates(contest)) return false;
          
          const status = getRegularContestStatus(contest, now);
          
          if (selectedStatus === 'active') {
            return status === 'active';
          } else if (selectedStatus === 'upcoming') {
            return status === 'upcoming';
          } else if (selectedStatus === 'past') {
            return status === 'past';
          }
          return true;
        }
      });
    }

    // Filter by price range
    if (priceRange) {
      filtered = filtered.filter(contest => {
        const price = contest.joining_fee;
        if (priceRange === 'free') {
          return price === 0;
        } else if (priceRange === 'low') {
          return price > 0 && price <= 50;
        } else if (priceRange === 'medium') {
          return price > 50 && price <= 200;
        } else if (priceRange === 'high') {
          return price > 200;
        }
        return true;
      });
    }

    // Sort filtered results
    const sorted = sortContests(filtered);
    setFilteredContests(sorted);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedStatus('');
    setPriceRange('');
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedStatus || priceRange;

  const [showPlayModal, setShowPlayModal] = useState(false);
  const [playModalData, setPlayModalData] = useState<{
    contest: Contest | null;
    message: string;
    timeRemaining?: string;
    isUpcoming?: boolean;
  }>({ contest: null, message: '', isUpcoming: false });

  const handlePlayClick = (contestId: string) => {
    const contest = allContests.find(c => c.id === contestId);
    if (!contest) return;

    // Handle daily contests
    if (isDailyContest(contest)) {
      const isLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
      
      if (isLive) {
        // Live - allow playing
        router.push(`/contest/${contestId}/rules`);
      } else {
        // Not live - show message with next start time
        const nextStart = getNextDailyStartTime(contest.dailyStartTime);
        if (nextStart) {
          const hours = nextStart.getHours();
          const minutes = nextStart.getMinutes();
          const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          
          setPlayModalData({
            contest,
            message: `Come back tomorrow to play daily quiz at ${timeStr}`,
            isUpcoming: false
          });
          setShowPlayModal(true);
        } else {
          setPlayModalData({
            contest,
            message: 'Daily quiz is not currently available',
            isUpcoming: false
          });
          setShowPlayModal(true);
        }
      }
      return;
    }

    // Handle regular contests
    if (!hasValidDates(contest)) {
      setPlayModalData({
        contest,
        message: 'Contest dates are not configured',
        isUpcoming: false
      });
      setShowPlayModal(true);
      return;
    }

    const now = new Date();
    const start = safeParseDate(contest.startDate);
    const end = safeParseDate(contest.endDate);
    
    if (!start || !end) {
      setPlayModalData({
        contest,
        message: 'Contest dates are invalid',
        isUpcoming: false
      });
      setShowPlayModal(true);
      return;
    }

    if (now < start) {
      // Upcoming - show time until start
      const diff = start.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeStr = '';
      if (days > 0) {
        timeStr = `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        timeStr = `${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else {
        timeStr = `${minutes} minute${minutes > 1 ? 's' : ''}`;
      }

      setPlayModalData({
        contest,
        message: `Quiz starts in ${timeStr}`,
        timeRemaining: timeStr,
        isUpcoming: true
      });
      setShowPlayModal(true);
    } else if (now > end) {
      // Past - show ended message
      setPlayModalData({
        contest,
        message: 'Quiz has ended',
        isUpcoming: false
      });
      setShowPlayModal(true);
    } else {
      // Live - allow playing
      router.push(`/contest/${contestId}/rules`);
    }
  };

  // Mock player count (in real app, fetch from API)
  const getPlayerCount = (contest: Contest): number => {
    // Return 0 for upcoming contests
    if (isDailyContest(contest)) {
      const isLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
      if (!isLive) return 0;
    } else {
      if (!contest.startDate || !contest.endDate) return 0;
      
      const startDate = contest.startDate;
      const endDate = contest.endDate;
      
      if (!hasValidDates(contest)) return 0;
      
      const now = new Date();
      const start = safeParseDate(contest.startDate);
      const end = safeParseDate(contest.endDate);
      
      if (!start || !end) return 0;
      if (now < start) return 0;
      // For past contests, return a random number in thousands (5k-25k)
      if (now > end) {
        return Math.floor(Math.random() * 20 + 5) * 1000; // Returns 5000-25000
      }
    }
    // Generate a random number between 50 and 500 for demo
    return Math.floor(Math.random() * 450) + 50;
  };

  return (
    <>
      <SEOHead 
        title="All Quizzes - Browse Complete Quiz Collection | Quizwala"
        description="Browse all available quizzes and contests on Quizwala. Filter by category, status, and difficulty. Find the perfect quiz to test your knowledge and earn coins!"
        keywords="all quizzes, quiz list, browse quizzes, quiz collection, all contests, quiz categories"
      />
      <DashboardNav />
      <div className="min-h-screen p-5">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-white text-2xl font-bold">All Contests</h1>
              <button
                onClick={() => router.back()}
                className="text-white underline hover:text-gray-300 transition-colors text-sm"
              >
                Back
              </button>
            </div>
            
            {/* Search Bar */}
            <div className="relative mb-4">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <svg
                  className="w-5 h-5 text-gray-700/70"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search contests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FFF6D9] text-gray-700 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-gray-700/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700/70 hover:text-white"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowFilterModal(true)}
                className={`relative px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  hasActiveFilters && !searchQuery
                    ? 'bg-[#FFF6D9] text-black'
                    : 'bg-[#FFF6D9] text-gray-700 '
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                Filter
                {hasActiveFilters && !searchQuery && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {[selectedCategory, selectedStatus, priceRange].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
          </div>

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

          {/* Contests List */}
          {!loading && !error && (
            <>
              {filteredContests.length === 0 ? (
                <div className="text-center text-white py-12">
                  <div className="text-lg mb-4">No contests found</div>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-yellow-400 underline hover:text-yellow-300"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredContests.map((contest) => (
                    <ContestCard
                      key={contest.id}
                      contest={contest}
                      playerCount={getPlayerCount(contest)}
                      onPlayClick={() => handlePlayClick(contest.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowFilterModal(false)}
        >
          <div
            className="bg-[#FFF6D9] rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[#BFBAA7]"
            style={{
              boxShadow: '0px 0px 2px 0px #FFF6D9'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#0D0009] px-6 py-4 flex items-center justify-between border-b border-[#BFBAA7]">
              <h2 className="text-[#FFF6D9] text-xl font-bold">Filter Contests</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-[#FFF6D9]/70 hover:text-[#FFF6D9] text-2xl font-light w-8 h-8 flex items-center justify-center transition-colors"
              >
                ×
              </button>
            </div>

            {/* Filter Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FFF6D9]">
              {/* Category Filter */}
              <div>
                <label className="text-[#0D0009] font-semibold mb-3 block">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white text-[#0D0009] rounded-xl px-4 py-3 border border-[#BFBAA7] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">All Categories</option>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[#0D0009] font-semibold mb-3 block">Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: '', label: 'All' },
                    { value: 'active', label: 'Active' },
                    { value: 'upcoming', label: 'Upcoming' },
                    { value: 'past', label: 'Past' },
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setSelectedStatus(status.value)}
                      className={`py-3 rounded-xl font-medium transition-colors ${
                        selectedStatus === status.value
                          ? 'bg-yellow-400 text-[#0D0009]'
                          : 'bg-[#0D0009] text-[#FFF6D9] hover:bg-[#0D0009]/80 border border-[#BFBAA7]'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Filter */}
              <div>
                <label className="text-[#0D0009] font-semibold mb-3 block">Price Range</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: '', label: 'All Prices' },
                    { value: 'free', label: 'Free' },
                    { value: 'low', label: '₹1 - ₹50' },
                    { value: 'medium', label: '₹51 - ₹200' },
                    { value: 'high', label: '₹200+' },
                  ].map((price) => (
                    <button
                      key={price.value}
                      onClick={() => setPriceRange(price.value)}
                      className={`py-3 rounded-xl font-medium transition-colors text-sm ${
                        priceRange === price.value
                          ? 'bg-yellow-400 text-[#0D0009]'
                          : 'bg-[#0D0009] text-[#FFF6D9] hover:bg-[#0D0009]/80 border border-[#BFBAA7]'
                      }`}
                    >
                      {price.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#0D0009] px-6 py-4 border-t border-[#BFBAA7] flex gap-3">
              <button
                onClick={clearFilters}
                className="flex-1 bg-[#FFF6D9] text-[#0D0009] py-3 rounded-xl font-bold hover:bg-[#FFF6D9]/80 transition-colors border border-[#BFBAA7]"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 bg-yellow-400 text-[#0D0009] py-3 rounded-xl font-bold hover:bg-yellow-500 transition-colors relative overflow-hidden"
              >
                <span className="relative z-10">Apply</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Play Modal */}
      {showPlayModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPlayModal(false)}
        >
          <div
            className="bg-[#2C2159] rounded-3xl w-full max-w-md p-8 text-center shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowPlayModal(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl font-light leading-none transition-colors w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
            
            <div className="mb-6">
              <div className="w-24 h-24 flex items-center justify-center mx-auto mb-4 relative">
                {playModalData.isUpcoming ? (
                  <img
                    src="/3d-alarm.png"
                    alt="Upcoming"
                    className="w-full h-full object-contain animate-cute-sway"
                  />
                ) : (
                  <img
                    src="/oops.svg"
                    alt="Ended"
                    className="w-full h-full object-contain animate-cute-sway"
                  />
                )}
              </div>
              <h3 className="text-white text-xl font-bold mb-2">
                {playModalData.contest?.name}
              </h3>
              <p className="text-white/80 text-lg mb-3">
                {playModalData.message}
              </p>
              {/* Player Count */}
              {playModalData.contest && (() => {
                const contest = playModalData.contest;
                const isDaily = isDailyContest(contest);
                const isDailyLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
                const endDate = safeParseDate(contest.endDate);
                const isPast = !isDaily && endDate !== null && new Date() > endDate;
                const playerCount = getPlayerCount(contest);
                
                return (
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <img src={'/timer.svg'} alt="User" className="w-4 h-4 object-contain" />
                    <span className="text-white opacity-70 text-sm">
                      {isPast 
                        ? `${Math.floor(playerCount / 1000)}k people played`
                        : (isDaily && !isDailyLive) 
                          ? '0 Players playing' 
                          : `${playerCount} Players playing`
                      }
                    </span>
                  </div>
                );
              })()}
            </div>
            <button
              onClick={() => setShowPlayModal(false)}
              className="w-full bg-yellow-400 text-[#392C6E] font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 transition-colors relative overflow-hidden"
            >
              <span className="relative z-10">OK</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

