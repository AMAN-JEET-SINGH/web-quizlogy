'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { QuizCard } from '@/components/QuizCard';
import { ContestCard } from '@/components/ContestCard';
import { PlayGamesSection } from '@/components/PlayGamesSection';
import AdsenseAd from '@/components/AdsenseAd';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { contestsApi, Contest, categoriesApi, Category, getImageUrl, authApi, battlesApi, Battle } from '@/lib/api';
import { isDailyContest, isDailyContestLive, getNextDailyStartTime } from '@/lib/dailyContestUtils';

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
    if (isDailyContest(contest)) {
      // Daily contest logic
      const isLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
      
      if (isLive) {
        liveDaily.push(contest);
      } else {
        // Check if it's past today's end time
        const [endHours, endMinutes] = (contest.dailyEndTime || '23:59').split(':').map(Number);
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
    } else {
      // Regular contest logic
      if (!contest.startDate || !contest.endDate) {
        past.push(contest);
        return;
      }

      const start = new Date(contest.startDate);
      const end = new Date(contest.endDate);

      if (now >= start && now <= end) {
        active.push(contest);
      } else if (now < start) {
        upcoming.push(contest);
      } else {
        past.push(contest);
      }
    }
  });

  // Sort live daily contests (no specific order needed, all are live)
  // Sort active by end date (ascending - ending soon first)
  active.sort((a, b) => {
    if (!a.endDate || !b.endDate) return 0;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });
  // Sort upcoming by start date (ascending)
  upcoming.sort((a, b) => {
    if (!a.startDate || !b.startDate) return 0;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
  // Sort past by end date (descending)
  past.sort((a, b) => {
    if (!a.endDate || !b.endDate) return 0;
    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
  });

  return [...liveDaily, ...active, ...upcomingDaily, ...upcoming, ...pastDaily, ...past];
};

export default function DashboardPage() {
  const router = useRouter();
  const [topBattles, setTopBattles] = useState<Battle[]>([]);
  const [favoriteBattles, setFavoriteBattles] = useState<Set<string>>(new Set());
  const [contestsForYou, setContestsForYou] = useState<Contest[]>([]);
  const [trendingQuizzes, setTrendingQuizzes] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBattles, setLoadingBattles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  // Random playing counts assigned per load so live contests sort by "highest players" and order changes on refresh
  const [liveContestPlayerCounts, setLiveContestPlayerCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchContests();
    fetchBattles();
    fetchCategories();
    // Check if user is logged in and fetch user data
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Check localStorage first - if no user stored, don't make API call
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      // No stored user, guest mode - don't make API call
      return;
    }
    
    try {
      // Only fetch from API if we have a stored user (to refresh coins)
      const user = await authApi.getCurrentUser();
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (err: any) {
      // If API call fails (401), user is no longer authenticated
      if (err?.response?.status === 401) {
        localStorage.removeItem('user');
      }
      // Silently handle - don't log 401 errors
    }
  };

  const fetchBattles = async () => {
    try {
      setLoadingBattles(true);
      const battles = await battlesApi.getAll('ACTIVE');
      
      // Sort battles by order field (higher order first), then by createdAt if order is same
      const sortedBattles = battles.sort((a, b) => {
        const orderA = (a as any).order || 0;
        const orderB = (b as any).order || 0;
        if (orderB !== orderA) {
          return orderB - orderA; // Higher order first
        }
        // If order is same, sort by createdAt (newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Get top 3 battles
      setTopBattles(sortedBattles.slice(0, 3));
    } catch (err) {
      console.error('Error fetching battles:', err);
    } finally {
      setLoadingBattles(false);
    }
  };

  const fetchContests = async () => {
    try {
      setLoading(true);
      const response = await contestsApi.getList();
      const contests = response.data || [];
      
      // Log what we received from backend
      // console.log('📥 Contests from backend:', contests.map(c => ({
      //   id: c.id,
      //   name: c.name,
      //   contestImage: c.contestImage,
      //   contestImageType: typeof c.contestImage
      // })));
      
      // Only show LIVE contests: daily that are in their time window, or regular that are between start and end
      const now = new Date();
      const liveContests = contests.filter((contest) => {
        if (isDailyContest(contest)) {
          return isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
        }
        if (!contest.startDate || !contest.endDate) return false;
        const start = new Date(contest.startDate);
        const end = new Date(contest.endDate);
        return now >= start && now <= end;
      });

      // Assign random playing count to each live contest (changes on refresh so order switches)
      const counts: Record<string, number> = {};
      liveContests.forEach((c) => {
        counts[c.id] = Math.floor(Math.random() * 600) + 100; // 100–700
      });
      setLiveContestPlayerCounts(counts);

      // Sort by assigned playing count descending (highest players on top)
      const sortedLive = [...liveContests].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));

      setContestsForYou(sortedLive.slice(0, 5));
      setTrendingQuizzes(sortedLive.slice(0, 8));
    } catch (err) {
      console.error('Error fetching contests:', err);
      setError('Failed to load contests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await categoriesApi.getAllWithDetails();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Get trending categories with specific styling
  const getTrendingCategories = (): Category[] => {
    if (!categories.length) return [];
    
    // Map category names to specific background colors (case-insensitive matching)
    const categoryColorMap: { [key: string]: string } = {
      'flags': '#FFF6D9',
      'logo quiz': '#E5F5FF',
      'indian mythology': '#FFEDF7',
      'marvel': '#E5F5FF',
    };

    // Find matching categories
    const trending: Category[] = [];
    const lowerNames = categories.map(c => c.name.toLowerCase());
    
    Object.entries(categoryColorMap).forEach(([name, bgColor]) => {
      const index = lowerNames.findIndex(n => n.includes(name) || name.includes(n));
      if (index !== -1) {
        const cat = categories[index];
        trending.push({ ...cat, backgroundColor: bgColor });
      }
    });

    // If we don't have 4, fill with first available categories (use their own backgroundColor or default)
    while (trending.length < 4 && trending.length < categories.length) {
      const remaining = categories.filter(c => !trending.some(t => t.id === c.id));
      if (remaining.length > 0) {
        const cat = remaining[0];
        trending.push(cat);
      } else {
        break;
      }
    }

    return trending.slice(0, 4);
  };

  const handleCategorySelect = (category: Category) => {
    const isSelected = selectedCategories.some(cat => cat.id === category.id);
    
    if (isSelected) {
      // Remove category
      setSelectedCategories(selectedCategories.filter(cat => cat.id !== category.id));
    } else {
      // Add category (max 3)
      if (selectedCategories.length < 3) {
        setSelectedCategories([...selectedCategories, category]);
      } else {
        alert('You can select maximum 3 categories');
      }
    }
  };

  const handleModalCategorySelect = (category: Category) => {
    handleCategorySelect(category);
  };

  const handleDone = () => {
    setShowCategoryModal(false);
  };

  const handleCreateQuiz = () => {
    if (selectedCategories.length === 0) {
      alert('Please select at least one category');
      return;
    }
    
    // Store selected category names in sessionStorage and redirect
    const categoryNames = selectedCategories.map(cat => cat.name);
    sessionStorage.setItem('customContestCategories', JSON.stringify(categoryNames));
    router.push('/custom-contest');
  };

  const handleCardClick = (contestId: string) => {
    // Navigate to contest rules page
    router.push(`/contest/${contestId}/rules`);
  };

  const handleBattleClick = (battleId: string) => {
    // Navigate to battle rules page
    router.push(`/battles/${battleId}/rules`);
  };

  const [showPlayModal, setShowPlayModal] = useState(false);
  const [playModalData, setPlayModalData] = useState<{
    contest: Contest | null;
    message: string;
    timeRemaining?: string;
    isUpcoming?: boolean;
  }>({ contest: null, message: '', isUpcoming: false });

  const handlePlayClick = (contestId: string) => {
    const contest = [...contestsForYou].find(c => c.id === contestId);
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
    if (!contest.startDate || !contest.endDate) {
      setPlayModalData({
        contest,
        message: 'Contest dates are not configured',
        isUpcoming: false
      });
      setShowPlayModal(true);
      return;
    }

    const now = new Date();
    const start = new Date(contest.startDate);
    const end = new Date(contest.endDate);

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

  // Use assigned random playing count for live contests (same as used for sorting); 0 otherwise
  const getPlayerCount = (contest: Contest): number => {
    if (liveContestPlayerCounts[contest.id] !== undefined) {
      return liveContestPlayerCounts[contest.id];
    }
    return 0;
  };

  return (
    <>
      <SEOHead 
        title="Quizwala Dashboard - Play Quizzes & Earn Coins"
        description="Explore top quizzes, daily contests, and trending quiz topics on Quizwala. Play quizzes, earn coins, and compete with players worldwide. Start your quiz journey today!"
        keywords="quiz dashboard, play quizzes, earn coins, daily quiz, quiz contests, quiz games, knowledge test"
      />
      <DashboardNav />
      <div className="min-h-screen ">
      {/* <div className="min-h-screen m-5"> */}
        <div className="max-w-4xl mx-auto">
          {/* Top Battles Section */}
          <div className="mb-8 m-5">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-white text-xl font-bold mb-1">Top Battles</h1>
                <p className="text-white text-sm">Test Between 2 Rivals</p>
              </div>
              <button
                onClick={() => router.push('/battles')}
                className="text-white underline hover:text-gray-300 transition-colors text-sm font-semibold uppercase"
              >
                SEE ALL
              </button>
            </div>

            {/* Loading State */}
            {loadingBattles && (
              <div className="text-center text-white py-12">
                <div className="text-lg">Loading battles...</div>
              </div>
            )}

            {/* Top Battles Grid */}
            {!loadingBattles && (
              <>
                {topBattles.length === 0 ? (
                  <div className="text-center text-white py-12">
                    <div className="text-lg">No battles available</div>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-between flex-nowrap">
                    {topBattles.slice(0, 3).map((battle) => {
                      const topColor = battle.backgroundColorTop || '#C0FFE3';
                      const bottomColor = battle.backgroundColorBottom || '#00AB5E';
                      const isFavorite = favoriteBattles.has(battle.id);
                      
                      return (
                      <div
                        key={battle.id}
                        className="relative rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform flex flex-col flex-1 basis-0 min-w-0"
                        onClick={() => handleBattleClick(battle.id)}
                        style={{
                          background: `linear-gradient(0deg, ${bottomColor} 0%, ${topColor} 100%)`,
                          aspectRatio: '140/120'
                        }}
                      >
                        {/* Heart Icon */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFavoriteBattles(prev => {
                              const newSet = new Set(prev);
                              if (isFavorite) {
                                newSet.delete(battle.id);
                              } else {
                                newSet.add(battle.id);
                              }
                              return newSet;
                            });
                          }}
                          className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-white hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill={isFavorite ? "#EF4444" : "none"}
                            stroke={isFavorite ? "#EF4444" : "#0D0009"}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                          </svg>
                        </button>
                        {/* Icon/Image Area */}
                        <div className="flex-1 p-1 flex items-center justify-center min-h-0">
                          {battle.imageUrl || battle.imagePath ? (
                            <img
                              src={battle.imageUrl || getImageUrl(battle.imagePath, 'battles')}
                              alt={battle.name}
                              className="object-contain max-h-full max-w-full"
                              style={{ maxHeight: '55%', maxWidth: '75%' }}
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                                const filename = battle.imagePath;

                                // Prevent infinite loop
                                const hasTriedCategories = img.dataset.triedCategories === 'true';
                                const hasTriedContests = img.dataset.triedContests === 'true';

                                if (filename && !filename.includes('/')) {
                                  if (img.src.includes('/uploads/contests/') && !hasTriedCategories) {
                                    img.dataset.triedContests = 'true';
                                    img.dataset.triedCategories = 'true';
                                    img.src = `${baseUrl}/uploads/categories/${filename}`;
                                  } else if (img.src.includes('/uploads/categories/') && !hasTriedContests) {
                                    img.dataset.triedCategories = 'true';
                                    img.dataset.triedContests = 'true';
                                    img.src = `${baseUrl}/uploads/contests/${filename}`;
                                  } else {
                                    img.style.display = 'none';
                                  }
                                } else {
                                  img.style.display = 'none';
                                }
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                              <span className="text-white text-xl font-bold">⚔️</span>
                            </div>
                          )}
                        </div>

                        {/* Title - Bottom Center */}
                        <div className="px-1 pb-1 pt-0 flex items-center justify-center flex-shrink-0">
                          <h3 className="text-white font-bold text-xs sm:text-sm text-center leading-tight break-words w-full">
                            {battle.name}
                          </h3>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* First Advertisement - Above the fold, after Top Quizzes */}
          <p className="text-center text-white text-xs border-t border-[#564C53] mt-2 mb-2 font-medium">ADVERTISEMENT</p>
                <div className="w-full overflow-hidden border-b border-[#564C53]">
                  <AdsenseAd adSlot="8153775072" adFormat="auto" />
                </div>

          {/* Quiz Contests For You Section - First 2 Contests */}
          <div className="mb-8 m-5">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-white text-xl font-bold">Quiz Contests For You</h1>
              <button
                onClick={() => router.push('/all-categories')}
                className="text-white underline hover:text-gray-300 transition-colors text-sm"
              >
                SEE ALL
              </button>
            </div>

            {/* First 2 Contests */}
            {!loading && !error && (
              <>
                {contestsForYou.length === 0 ? (
                  <div className="text-center text-white py-12">
                    <div className="text-lg">No contests available</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contestsForYou.slice(0).map((contest) => (
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

          {/* Play Games Section */}
          <PlayGamesSection />

          {/* Remaining Quiz Contests For You */}
          {/* {!loading && !error && contestsForYou.length > 2 && (
            <div className="mb-8 m-5">
              <div className="space-y-4">
                {contestsForYou.slice(0).map((contest) => (
                  <ContestCard
                    key={contest.id}
                    contest={contest}
                    playerCount={getPlayerCount(contest)}
                    onPlayClick={() => handlePlayClick(contest.id)}
                  />
                ))}
              </div>
            </div>
          )} */}

          {/* Second Advertisement - Between content sections for maximum visibility */}
          {/* <div className="bg-[#2C2159] rounded-lg p-4 mb-8 shadow-lg">
            <p className="text-center text-[#7563C0] text-xs mb-2 font-medium">ADVERTISEMENT</p>
            <div className="w-full overflow-hidden">
              <AdsenseAd adSlot="1314351516" adFormat="auto" />
            </div>
          </div> */}

          {/* Quiz Bite Section */}
          <div className="mb-8 m-5">
            <div className="mb-4">
              <h1 className="text-white text-2xl font-bold mb-2">Quiz Bite</h1>
              <p className="text-white/70 text-sm">Short, quick quizzes from topics you love!</p>
            </div>

            <div className="bg-[#9272FF] rounded-xl p-4 sm:p-6 mb-8" style={{
                  boxShadow: '0px 0px 2px 0px #FFF6D9'
            }}>
              <h2 className="text-[#FFFFFF] text-lg font-bold text-center mb-4 sm:mb-6">Pick Upto 3 Categories</h2>
              
              <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-8 mb-4 sm:mb-6">
                {[0, 1, 2].map((index) => {
                  const category = selectedCategories[index];
                  return (
                    <div
                      key={index}
                      className={`relative flex flex-col w-full rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-105 aspect-[3/4] ${
                        category ? 'bg-[#FFF6D9]' : 'bg-[#0D0009] border border-dashed border-[#FBD457]'
                      }`}
                      onClick={() => {
                        if (category) {
                          // Remove category
                          setSelectedCategories(selectedCategories.filter((_, i) => i !== index));
                        } else {
                          // Open category selection modal
                          if (selectedCategories.length < 3) {
                            setShowCategoryModal(true);
                          }
                        }
                      }}
                    >
                      {category ? (
                        <>
                          <div className="flex-1 min-h-0 p-2 sm:p-4 flex items-center justify-center">
                            {(category.imagePath || category.image) ? (
                              <img
                                src={getImageUrl(category.imagePath || category.image, 'category')}
                                alt={category.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                                  const filename = category.imagePath || category.image;
                                  
                                  // Prevent infinite loop
                                  const hasTriedCategories = img.dataset.triedCategories === 'true';
                                  const hasTriedContests = img.dataset.triedContests === 'true';
                                  
                                  // If first attempt failed and it's just a filename, try the other folder
                                  if (filename && !filename.includes('/')) {
                                    if (img.src.includes('/uploads/categories/') && !hasTriedContests) {
                                      // First try was categories, now try contests
                                      img.dataset.triedCategories = 'true';
                                      img.dataset.triedContests = 'true';
                                      img.src = `${baseUrl}/uploads/contests/${filename}`;
                                    } else if (img.src.includes('/uploads/contests/') && !hasTriedCategories) {
                                      // First try was contests, now try categories
                                      img.dataset.triedContests = 'true';
                                      img.dataset.triedCategories = 'true';
                                      img.src = `${baseUrl}/uploads/categories/${filename}`;
                                    } else {
                                      // Both folders tried, hide image
                                      img.style.display = 'none';
                                    }
                                  } else {
                                    img.style.display = 'none';
                                  }
                                }}
                              />
                            ) : (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <div className="relative w-12 h-10">
                                  <div className="absolute top-0 left-1.5 w-6 h-4 bg-blue-500 rounded-full"></div>
                                  <div className="absolute top-0.5 right-1.5 w-5 h-4 bg-green-500 rounded-full"></div>
                                  <div className="absolute bottom-1.5 left-3 w-4 h-4 bg-yellow-400 rounded-full"></div>
                                  <div className="absolute bottom-1 right-3 w-4 h-3 bg-red-500 rounded-full"></div>
                                  <div className="absolute top-2 left-4.5 w-3 h-2 bg-purple-500 rounded-full"></div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="bg-[#FFF6D9] rounded-b-xl px-2 sm:px-3 py-1.5 sm:py-2 flex-shrink-0">
                            <p className="text-black font-semibold text-xs text-center truncate">
                              {category.name}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCategories(selectedCategories.filter((_, i) => i !== index));
                            }}
                            className="absolute top-2 right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold hover:bg-red-600"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center min-h-0">
                          <span className="text-[#FFF6D9] text-2xl sm:text-3xl font-light">+</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>


              <button
                onClick={handleCreateQuiz}
                disabled={selectedCategories.length === 0}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
                  selectedCategories.length === 0
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    : 'bg-[#FBD457] text-[#0D0009] hover:bg-yellow-500'
                }`}
              >
                Create Quiz
              </button>
            </div>
          </div>

          {/* Trending Quiz Topics Section */}
          <div className="mb-8 m-5">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-white text-xl font-bold">Trending Quiz Topics</h1>
              <button
                onClick={() => router.push('/all-categories')}
                className="text-[#FFD602] underline hover:text-[#FFE033] transition-colors text-sm font-semibold uppercase"
              >
                SEE ALL
              </button>
            </div>

            {/* Trending Category Cards */}
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-5 px-5 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {getTrendingCategories().map((category) => {
                const categoryImageUrl = category.imageUrl || getImageUrl(category.imagePath || category.image || '');
                const bgColor = category.backgroundColor || '#FFF6D9';

                return (
                  <div
                    key={category.id}
                    onClick={() => router.push(`/category/${encodeURIComponent(category.name)}?id=${category.id}`)}
                    className="flex-shrink-0 cursor-pointer hover:scale-[1.02] transition-transform shadow-lg flex flex-col items-center justify-center rounded-2xl overflow-hidden"
                    style={{
                      width: '100px',
                      height: '100px',
                      backgroundColor: bgColor,
                      padding: '10px'
                    }}
                  >
                    {/* Category Icon */}
                    <div className="flex-1 flex items-center justify-center w-full">
                      {categoryImageUrl ? (
                        <img
                          src={categoryImageUrl}
                          alt={category.name}
                          className="object-contain"
                          style={{ width: '50px', height: '50px' }}
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-[#0D0009]/10 rounded-full flex items-center justify-center">
                          <span className="text-lg font-semibold text-[#0D0009]/40">
                            {category.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Category Name */}
                    <p className="text-[#0D0009] font-bold text-[10px] text-center leading-tight w-full truncate">
                      {category.name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          
        </div>
        
      </div>
      {/* Footer */}
      <Footer />

      {/* Category Selection Modal */}
      {showCategoryModal && (
        <div 
          className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowCategoryModal(false)}
        >
          <div 
            className="bg-[#0D0009] rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            style={{
              boxShadow: '0px 0px 2px 0px #FFF6D9'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#0D0009] px-6 py-4 flex items-center justify-between border-b border-[#FFF6D9]/20">
              <h2 className="text-[#FFF6D9] text-xl font-bold">Select Categories</h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-[#FFF6D9]/70 hover:text-[#FFF6D9] text-2xl font-light w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Selected Count */}
            <div className="px-6 py-3 bg-[#0D0009]/80">
              <p className="text-[#FFF6D9]/70 text-sm">
                Selected: <span className="text-yellow-400 font-semibold">{selectedCategories.length}/3</span>
              </p>
            </div>

            {/* Categories Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#0D0009]">
              {loadingCategories ? (
                <div className="text-center text-[#FFF6D9] py-12">
                  <div className="text-lg">Loading categories...</div>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center text-[#FFF6D9]/70 py-12">
                  <div className="text-lg">No categories available</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {categories.map((category) => {
                    const isSelected = selectedCategories.some(cat => cat.id === category.id);
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleModalCategorySelect(category)}
                        disabled={!isSelected && selectedCategories.length >= 3}
                        className={`relative rounded-xl overflow-hidden transition-all ${
                          isSelected
                            ? 'ring-4 ring-yellow-400 scale-105'
                            : selectedCategories.length >= 3
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:scale-105 active:scale-95'
                        }`}
                      >
                        {/* Category Card */}
                        <div className={`${isSelected ? 'bg-[#FFF6D9]' : 'bg-[#0D0009] border-2 border-[#FFF6D9]/30'} rounded-xl p-4`}
                          style={!isSelected ? {
                            boxShadow: '0px 0px 2px 0px #FFF6D9'
                          } : {}}
                        >
                          {/* Image */}
                          <div className="h-24 mb-3 flex items-center justify-center">
                            {(category.imagePath || category.image) ? (
                              <img
                                src={getImageUrl(category.imagePath || category.image, 'category')}
                                alt={category.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                                  const filename = category.imagePath || category.image;
                                  
                                  // Prevent infinite loop
                                  const hasTriedCategories = img.dataset.triedCategories === 'true';
                                  const hasTriedContests = img.dataset.triedContests === 'true';
                                  
                                  // If first attempt failed and it's just a filename, try the other folder
                                  if (filename && !filename.includes('/')) {
                                    if (img.src.includes('/uploads/categories/') && !hasTriedContests) {
                                      // First try was categories, now try contests
                                      img.dataset.triedCategories = 'true';
                                      img.dataset.triedContests = 'true';
                                      img.src = `${baseUrl}/uploads/contests/${filename}`;
                                    } else if (img.src.includes('/uploads/contests/') && !hasTriedCategories) {
                                      // First try was contests, now try categories
                                      img.dataset.triedContests = 'true';
                                      img.dataset.triedCategories = 'true';
                                      img.src = `${baseUrl}/uploads/categories/${filename}`;
                                    } else {
                                      // Both folders tried, hide image
                                      img.style.display = 'none';
                                    }
                                  } else {
                                    img.style.display = 'none';
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 flex items-center justify-center">
                                <div className="relative w-12 h-10">
                                  <div className="absolute top-0 left-1.5 w-6 h-4 bg-blue-500 rounded-full"></div>
                                  <div className="absolute top-0.5 right-1.5 w-5 h-4 bg-green-500 rounded-full"></div>
                                  <div className="absolute bottom-1.5 left-3 w-4 h-4 bg-yellow-400 rounded-full"></div>
                                  <div className="absolute bottom-1 right-3 w-4 h-3 bg-red-500 rounded-full"></div>
                                  <div className="absolute top-2 left-4.5 w-3 h-2 bg-purple-500 rounded-full"></div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Category Name */}
                          <p className={`text-center font-semibold text-sm truncate ${
                            isSelected ? 'text-[#0D0009]' : 'text-[#FFF6D9]'
                          }`}>
                            {category.name}
                          </p>
                        </div>

                        {/* Tick Mark */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                            <svg
                              className="w-4 h-4 text-[#0D0009]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="3"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#0D0009] px-6 py-4 border-t border-[#FFF6D9]/20">
              <button
                onClick={handleDone}
                className="w-full bg-yellow-400 text-[#0D0009] py-3 rounded-xl font-bold text-lg hover:bg-yellow-500 transition-colors active:scale-95 relative overflow-hidden"
              >
                <span className="relative z-10">Done ({selectedCategories.length}/3)</span>
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
                const isPast = !isDaily && contest.endDate && new Date() > new Date(contest.endDate);
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

