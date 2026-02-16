'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SEOHead } from '@/components/SEOHead';
import { battlesApi, Battle, authApi, User } from '@/lib/api';
import { getImageUrl } from '@/lib/api';
import './rules.css';

export default function BattleRulesPage() {
  const router = useRouter();
  const params = useParams();
  const battleId = params?.id as string;

  const [battle, setBattle] = useState<Battle | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBattleData();
    fetchUserData();
  }, [battleId]);

  const fetchBattleData = async () => {
    try {
      setLoading(true);
      const data = await battlesApi.getById(battleId);
      const battleData = (data as any).data || data;
      setBattle(battleData);
    } catch (err) {
      console.error('Error fetching battle:', err);
      router.push('/battles');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (err) {
          setUser(parsedUser);
        }
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  const handlePlayBattle = () => {
    if (battleId) {
      router.push(`/battles/${battleId}`);
    }
  };

  if (loading) {
    return (
      <>
        <SEOHead title="Loading Battle Rules..." description="Loading battle rules..." />
        <div className="min-h-screen bg-[#0D0009]">
          <DashboardNav />
          <LoadingScreen message="Loading battle rules..." fullPage />
          <Footer />
        </div>
      </>
    );
  }

  if (!battle) {
    return null;
  }

  const topColor = battle.backgroundColorTop || '#FF6B35';
  const bottomColor = battle.backgroundColorBottom || '#00AB5E';
  const battleImageUrl = battle.imageUrl || getImageUrl(battle.imagePath, 'battles');

  return (
    <>
      <SEOHead
        title={`${battle.name} - Battle Rules`}
        description={`Rules for ${battle.name || 'Battle'}`}
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#0D0009]">
        <div className="container mx-auto px-4 sm:px-6 py-4 pb-4 mb-20">
          {/* Main Banner Card with bg-battle.svg */}
          <div className="battle-rules-banner relative rounded-2xl overflow-hidden mb-4" style={{ minHeight: '280px' }}>
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
                <img 
                  src="/sword.webp" 
                  alt="Battle" 
                  className="w-[100%] h-[100%] object-contain" 
                />
              </div>
            </div>
            {/* Text Overlay */}
            <div 
              className="relative z-10 px-6 pb-3"
              style={{
                background: 'linear-gradient(180deg, rgba(13, 0, 9, 0) 0%, #0D0009 100%)'
              }}
            >
              <h1 className="text-white text-xl sm:text-2xl md:text-3xl font-bold mb-1">
                Quizwala Battles
              </h1>
              <p className="text-white font-normal text-sm sm:text-base">
                Head-to-head quiz matches!
              </p>
            </div>
          </div>

          {/* Chain Links */}
          {/* <div className="relative flex justify-between items-start -mt-2 mb-0 px-4">
            <img 
              src="/chain.svg" 
              alt="Chain" 
              className="battle-rules-chain w-12 h-6 sm:w-14 sm:h-8 object-contain"
              style={{ marginLeft: '10%' }}
            />
            <img 
              src="/chain.svg" 
              alt="Chain" 
              className="battle-rules-chain w-12 h-6 sm:w-14 sm:h-8 object-contain"
              style={{ marginRight: '10%' }}
            />
          </div> */}

          {/* Rules Section */}
          <div 
            className="battle-rules-section relative rounded-2xl p-6 mb-6"
            style={{
              backgroundImage: 'url(/Maskgroup.svg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              minHeight: '200px'
            }}
          >
            {/* Rules List */}
            <div className="flex flex-col items-center justify-center space-y-4 min-h-[150px]">
              {/* Rule 1: Rapid Fire Round */}
              <div className="flex items-center justify-center gap-3">
                <div className="flex-shrink-0">
                  <img src="/fire.png" alt="Fire" className="w-6 h-6 object-contain" />
                </div>
                <span className="text-white text-base sm:text-lg font-semibold">
                  Rapid Fire Round
                </span>
              </div>

              {/* Rule 2: 5 Questions, 50 Seconds */}
              <div className="flex items-center justify-center gap-3">
                <div className="flex-shrink-0">
                  <img src="/goal.png" alt="Goal" className="w-6 h-6 object-contain" />
                </div>
                <span className="text-white text-base sm:text-lg font-semibold">
                  5 Questions, 50 Seconds
                </span>
              </div>

              {/* Rule 3: May The Best Fan Win */}
              <div className="flex items-center justify-center gap-3">
                <div className="flex-shrink-0">
                  <img src="/winning.png" alt="Winning" className="w-6 h-6 object-contain" />
                </div>
                <span className="text-white text-base sm:text-lg font-semibold">
                  May The Best Fan Win!
                </span>
              </div>
            </div>
          </div>

          {/* Play Battle Button - sticky at bottom of screen until footer is in view */}
          <div className="sticky bottom-0 left-0 right-0 z-20 pt-3 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 bg-[#0D0009] border-t border-[#FFF6D9]/10">
            <button
              onClick={handlePlayBattle}
              className="w-full max-w-md mx-auto block bg-[#FFD602] text-[#0D0009] font-bold py-4 rounded-xl hover:bg-[#FFE033] transition-colors text-lg sm:text-xl shadow-lg"
            >
              Play Battle
            </button>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
