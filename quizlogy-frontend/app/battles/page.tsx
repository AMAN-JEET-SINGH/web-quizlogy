'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { battlesApi, Battle, getImageUrl } from '@/lib/api';
import './battles.css';
import AdsenseAd from '@/components/AdsenseAd';
import { PlayGamesSection } from '@/components/PlayGamesSection';

export default function BattlesPage() {
  const router = useRouter();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [filteredBattles, setFilteredBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchBattles();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBattles(battles);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = battles.filter(battle =>
        battle.name.toLowerCase().includes(query) ||
        (battle.description && battle.description.toLowerCase().includes(query))
      );
      setFilteredBattles(filtered);
    }
    // Reset showAll when search changes
    setShowAll(false);
  }, [searchQuery, battles]);

  const fetchBattles = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Fetching battles...');
      const data = await battlesApi.getAll('ACTIVE');
      console.log('✅ Battles fetched:', data);
      setBattles(data);
      setFilteredBattles(data);
    } catch (err: any) {
      console.error('❌ Error fetching battles:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      setError(err.response?.data?.error || err.message || 'Failed to load battles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBattleClick = (battleId: string) => {
    router.push(`/battles/${battleId}/rules`);
  };

  const displayedBattles = showAll ? filteredBattles : filteredBattles.slice(0, 4);
  const hasMoreBattles = filteredBattles.length > 4;

  return (
    <>
      <SEOHead
        title="Battles - QuizAngoMedia"
        description="Challenge yourself with exciting battles and quizzes"
      />
      <div className="min-h-screen bg-[#0D0009]">
        <DashboardNav />

        <div className="container mx-auto px-4 sm:px-6 py-6">
          {/* Header Card with bg-battle.svg */}
          <div className="relative rounded-t-2xl overflow-hidden mb-6" style={{ minHeight: '200px' }}>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'url(/bg-battle.svg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            />
            {/* Shield and Sword Illustration (centered) */}
            <div className="relative z-10 flex items-center justify-center h-full py-8 mt-10">
              <div className="flex items-center justify-center">
                {/* Shield and Sword SVG - placeholder, you can replace with actual illustration */}
                <img src="/sword.webp" alt="Battles" className="w-[100%] h-[100%] object-contain" />
              </div>
            </div>
            {/* Text Overlay */}
            <div 
              className="relative z-10 px-6 pb-3"
              style={{
                background: 'linear-gradient(180deg, rgba(13, 0, 9, 0) 0%, #0D0009 100%)'
              }}
            >
              <h1 className="text-white text-xl sm:text-xl font-600 mb-1">Quizwala Battles</h1>
              <p className="text-white  font-400 text-sm sm:text-base">Head-to-head quiz matches!</p>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-4">
                <div className="w-12 h-12 rounded-full border-4 border-[#FFF6D9]/20 border-t-[#FFD602] animate-loading-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <img src="/logo.svg" alt="" className="w-5 h-5 opacity-90" />
                </div>
              </div>
              <p className="text-[#FFF6D9] font-medium">Loading battles...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-12">
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-[#FF6B6B] opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-[#FFF6D9] font-medium">{error}</p>
            </div>
          )}

          {/* Battles List */}
          {!loading && !error && (
            <>
              {filteredBattles.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4">
                    <svg className="w-12 h-12 mx-auto text-[#FFD602] opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-[#FFF6D9] font-medium">No battles found.</p>
                  {searchQuery && <p className="text-[#FFF6D9]/60 text-sm mt-1">Try a different search.</p>}
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {displayedBattles.map((battle) => {
                    const topColor = battle.backgroundColorTop || '#C0FFE3';
                    const bottomColor = battle.backgroundColorBottom || '#00AB5E';
                    const battleImageUrl = battle.imageUrl || getImageUrl(battle.imagePath, 'battles');
                    
                    return (
                      <div
                        key={battle.id}
                        className="bg-[#0D0009] rounded-xl border border-white/10 flex items-center gap-3 p-2 sm:p-3"
                      >
                        {/* Left - Icon with Gradient Background */}
                        <div
                          className="flex-shrink-0 rounded-lg overflow-hidden"
                          style={{
                            width: '50px',
                            height: '50px',
                            background: `linear-gradient(0deg, ${bottomColor} 0%, ${topColor} 100%)`
                          }}
                        >
                          {battleImageUrl ? (
                            <img
                              src={battleImageUrl}
                              alt={battle.name}
                              className="w-full h-full object-contain p-1.5"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                                const filename = battle.imagePath;

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
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-white text-xl">⚔️</span>
                            </div>
                          )}
                        </div>

                        {/* Middle - Battle Name */}
                        <div className="flex-1">
                          <h3 className="text-white font-semibold text-sm sm:text-base">
                            {battle.name}
                          </h3>
                        </div>

                        {/* Right - Play Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBattleClick(battle.id);
                          }}
                          className="bg-[#FFD602] text-[#0D0009] font-bold px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg hover:bg-[#FFE033] transition-colors flex-shrink-0 text-xs sm:text-sm"
                        >
                          Play
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Show More/Show Less Battles Button */}
          {!loading && !error && hasMoreBattles && (
            <button
              onClick={() => {
                setShowAll(!showAll);
              }}
              className="w-full bg-[#FFD602] text-[#0D0009] font-bold py-4 rounded-xl hover:bg-[#FFE033] transition-colors text-base sm:text-lg mb-6"
            >
              {showAll ? 'Show Less' : 'Show More Battles'}
            </button>
          )}

          {/* Advertisement */}
          
        </div>
        <div className="w-full mb-6">
            <p className="text-center text-white text-xs mt-2 mb-2 font-medium border-t border-[#564C53] pt-2">ADVERTISEMENT</p>
            <div className="w-full overflow-hidden border-b border-[#564C53]">
              <AdsenseAd adSlot="8153775072" adFormat="auto" />
            </div>
          </div>
          <PlayGamesSection/>
        <Footer />
      </div>
    </>
  );
}
