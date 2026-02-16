'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { ContestCard } from '@/components/ContestCard';
import AdsenseAd from '@/components/AdsenseAd';
import { categoriesApi, Category, contestsApi, Contest, getImageUrl } from '@/lib/api';
import { isDailyContest } from '@/lib/dailyContestUtils';

export default function CategoryDetailPage({ params }: { params: { name: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryId = searchParams.get('id');
  
  const [category, setCategory] = useState<Category | null>(null);
  const [contests, setContests] = useState<Contest[]>([]);
  const [heroMeta, setHeroMeta] = useState<{ questionCount: number; durationSeconds: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    if (categoryId) {
      fetchCategoryAndContests();
    }
  }, [categoryId]);

  const fetchCategoryAndContests = async () => {
    try {
      setLoading(true);
      
      // Fetch category details using ID from query params
      const categories = await categoriesApi.getAllWithDetails();
      const foundCategory = categories.find(cat => cat.id === categoryId);
      
      if (!foundCategory) {
        setError('Category not found');
        return;
      }
      
      setCategory(foundCategory);
      
      // Fetch contests for this category
      const contestsData = await contestsApi.getList({ category: categoryId ?? undefined });
      const categoryContests = contestsData.data.filter(contest => 
        contest.category === categoryId &&
        !isDailyContest(contest)
      );
      
      setContests(categoryContests);

      // Fetch hero contest meta (question count + duration)
      if (categoryContests.length > 0) {
        try {
          const details = await contestsApi.getContestById(categoryContests[0].id);
          const detailsData = details?.data;
          const questionCount =
            typeof detailsData?.contest_question_count === 'number'
              ? detailsData.contest_question_count
              : 10;
          const durationSeconds =
            typeof detailsData?.duration === 'number' ? detailsData.duration : 90;
          setHeroMeta({ questionCount, durationSeconds });
        } catch {
          setHeroMeta({ questionCount: 10, durationSeconds: 90 });
        }
      } else {
        setHeroMeta(null);
      }
    } catch (err) {
      console.error('Failed to fetch category data:', err);
      setError('Failed to load category');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayClick = (contestId: string) => {
    router.push(`/contest/${contestId}/rules`);
  };

  if (loading) {
    return (
      <>
        <SEOHead 
          title="Loading Category - Quizlogy"
          description="Loading category details..."
        />
        <div className="min-h-screen bg-[#0D0009]">
          <DashboardNav />
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFF6D9]"></div>
          </div>
        </div>
      </>
    );
  }

  if (error || !category) {
    return (
      <>
        <SEOHead 
          title="Category Not Found - Quizlogy"
          description="The requested category could not be found"
        />
        <div className="min-h-screen bg-[#0D0009]">
          <DashboardNav />
          <div className="container mx-auto px-4 py-8 text-center">
            <p className="text-[#FFF6D9] text-lg">{error || 'Category not found'}</p>
            <button
              onClick={() => router.push('/all-categories')}
              className="mt-4 px-6 py-2 bg-[#9272FF] text-white rounded-lg"
            >
              Back to Categories
            </button>
          </div>
        </div>
      </>
    );
  }

  const categoryImageUrl = category.imageUrl || getImageUrl(category.imagePath || category.image || '');
  const backgroundColor = category.backgroundColor || '#FFFFFF';
  const heroContest = contests[0];
  const heroLogoUrl = heroContest?.contestImage ? getImageUrl(heroContest.contestImage) : categoryImageUrl;
  const heroQuestionCount = heroMeta?.questionCount ?? 10;
  const heroDurationMins = Math.ceil((heroMeta?.durationSeconds ?? 90) / 60);
  const heroInfoText = `${category.name.toUpperCase()} QUIZ. ${heroQuestionCount} QUESTIONS. ${heroDurationMins} MINS`;

  return (
    <>
      <SEOHead 
        title={`${category.name} - Quizlogy`}
        description={category.description || `Explore ${category.name} quizzes and contests on Quizlogy`}
      />
      <div className="min-h-screen bg-[#0D0009]">
        <DashboardNav />
        
        <div className="container mx-auto py-4 sm:py-6">
          {/* About Category Section */}
          <div className="mb-6 px-4">
            <h2 className="text-lg sm:text-xl font-bold text-[#FFF6D9] mb-4">About {category.name}</h2>
            <div className="bg-[#1a0f15] rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
              {/* Category Image Card */}
              <div className="flex-shrink-0">
                <div
                  className="rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center overflow-hidden"
                  style={{
                    backgroundColor: backgroundColor,
                    width: '120px',
                    height: '140px',
                    minWidth: '120px'
                  }}
                >
                  {/* Image container with fixed size */}
                  <div className="w-[80px] h-[80px] flex items-center justify-center flex-shrink-0">
                    {categoryImageUrl ? (
                      <img
                        src={categoryImageUrl}
                        alt={category.name}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-[#0D0009]/10 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-[#0D0009]/30">
                          {category.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Category name with truncation */}
                  <p className="text-xs sm:text-sm font-semibold text-[#0D0009] mt-2 text-center w-full truncate px-1">
                    {category.name}
                  </p>
                </div>
              </div>
              
              {/* Category Description */}
              <div className="flex-1">
                <p
                  className={`text-[#FFF6D9] text-sm leading-relaxed ${
                    !isDescriptionExpanded ? 'line-clamp-4' : ''
                  }`}
                >
                  {category.description || `Welcome to the ${category.name} category on Quizlogy, where you can test your knowledge and compete in exciting quizzes. Challenge yourself with questions covering various topics and win amazing prizes!`}
                </p>
                {(category.description?.length ?? 0) > 150 && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="text-[#FFD602] text-sm mt-2 font-semibold hover:underline"
                  >
                    {isDescriptionExpanded ? 'Read Less' : 'Read More'}
                  </button>
                )}
              </div>
            </div>
          </div>
              <div className="px-4">
          {/* Hero info line (outside card) */}
          <p className="text-center text-[#FFF6D9]/80 text-xs sm:text-sm mb-3">
            {heroInfoText}
          </p>

          {/* Tap to Play Card */}
          <div
            className="relative rounded-2xl p-6 sm:p-8 mb-6 overflow-hidden border border-[#564C53] min-h-[150px] sm:min-h-[170px]"
            style={{
              background: `linear-gradient(90deg, #0D0009 42.05%, rgba(13, 0, 9, 0) 100%)`,
            }}
          >
            {/* bg-quiz as background for the whole card */}
            <div
              className="absolute inset-0 opacity-35"
              style={{
                backgroundImage: 'url(/bg-quiz.svg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                filter: 'brightness(1.15)',
              }}
            />

            {/* Content wrapper with flex layout */}
            <div className="relative z-10 flex items-center justify-between h-full">
              {/* Text content */}
              <div className="flex-1 pr-4">
                <p className="text-[#FFF6D9] text-lg sm:text-xl font-semibold mb-4">
                  We've got a {category.name} quiz for you!
                </p>
                <button
                  onClick={() => {
                    if (contests.length > 0) {
                      handlePlayClick(contests[0].id);
                    } else {
                      router.push('/all-contests');
                    }
                  }}
                  className="bg-[#FFD602] text-[#0D0009] font-bold px-6 py-3 rounded-lg hover:bg-[#FFE033] transition-colors"
                >
                  TAP TO PLAY
                </button>
              </div>

              {/* Category/contest logo - contained within card */}
              {heroLogoUrl && (
                <div className="flex-shrink-0 w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 flex items-center justify-center">
                  <img
                    src={heroLogoUrl}
                    alt={heroContest?.name || category.name}
                    className="max-w-full max-h-full object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          </div>

          {/* First Advertisement */}
          <div className="w-full ">
            <p className="text-center text-white text-xs mt-2 mb-2 font-medium border-t border-[#564C53] pt-1">ADVERTISEMENT</p>
            <div className="w-full overflow-hidden border-b border-[#564C53]">
              <AdsenseAd adSlot="8153775072" adFormat="auto" />
            </div>
          </div>

          {/* Contests In Category Section */}
          <div className="px-4">
          <div className="mt-6">
            <h2 className="text-lg sm:text-xl font-bold text-[#FFF6D9] mb-4">
              Contests In {category.name}
            </h2>
            
            {contests.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#FFF6D9]/60 text-base">
                  No contests available in this category at the moment.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {contests.map((contest) => (
                  <ContestCard
                    key={contest.id}
                    contest={contest}
                    playerCount={217}
                    onPlayClick={() => handlePlayClick(contest.id)}
                  />
                ))}
              </div>
            )}
          </div>
          </div>

          {/* Second Advertisement */}
          <div className="w-full ">
            <p className="text-center text-white text-xs mt-2 mb-2 font-medium border-t border-[#564C53] pt-1">ADVERTISEMENT</p>
            <div className="w-full overflow-hidden">
              <AdsenseAd adSlot="8153775072" adFormat="auto" />
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
