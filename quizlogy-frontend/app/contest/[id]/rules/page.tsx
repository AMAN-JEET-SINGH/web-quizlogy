'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { contestsApi, authApi, getImageUrl } from '@/lib/api';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import AdsenseAd from '@/components/AdsenseAd';

interface ContestDetails {
  id: string;
  name: string;
  contestImage: string;
  joining_fee: number;
  duration: number;
  marking: number;
  negative_marking: number;
  contest_question_count: number;
  winCoins: number;
}

export default function ContestRulesPage() {
  const router = useRouter();
  const params = useParams();
  const contestId = params?.id as string;
  
  const [contest, setContest] = useState<ContestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showInsufficientCoinsModal, setShowInsufficientCoinsModal] = useState(false);

  useEffect(() => {
    if (contestId) {
      fetchContestDetails();
    }
    checkAuthStatus();
    
    // Listen for storage changes (when user logs in from another tab/window)
    const handleStorageChange = () => {
      checkAuthStatus();
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case of same-tab login
    const interval = setInterval(checkAuthStatus, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [contestId]);

  const checkAuthStatus = () => {
    const storedUser = localStorage.getItem('user');
    setIsLoggedIn(!!storedUser);
  };

  const fetchContestDetails = async () => {
    try {
      setLoading(true);
      const response = await contestsApi.getContestById(contestId);
      if (response.status && response.data) {
        setContest({
          id: response.data.id,
          name: response.data.name,
          contestImage: response.data.contestImage,
          joining_fee: response.data.joining_fee || 0,
          duration: response.data.duration || 60,
          marking: response.data.marking || 25,
          negative_marking: response.data.negative_marking || 10,
          contest_question_count: response.data.contest_question_count || 0,
          winCoins: response.data.winCoins || 0,
        });
      } else {
        setError('Contest not found');
      }
    } catch (err) {
      console.error('Error fetching contest:', err);
      setError('Failed to load contest details');
    } finally {
      setLoading(false);
    }
  };

  const handleStartContest = async () => {
    if (!contestId || !contest) return;

    try {
      setJoining(true);

      const storedUser = localStorage.getItem('user');
      const isGuest = !storedUser;

      // Check if contest has a joining fee
      if (contest.joining_fee > 0) {
        if (isGuest) {
          // Guest user - check localStorage coins
          const guestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
          if (guestCoins < contest.joining_fee) {
            setShowInsufficientCoinsModal(true);
            setJoining(false);
            return;
          }
          // Deduct from guest coins
          const newGuestCoins = guestCoins - contest.joining_fee;
          localStorage.setItem('guestCoins', newGuestCoins.toString());
          // Trigger coins update event for navbar
          window.dispatchEvent(new Event('coinsUpdated'));
        } else {
          // Logged in user - join contest (this will deduct coins)
          await contestsApi.joinContest(contestId);
          
          // Update user data in localStorage
          try {
            const userData = await authApi.getCurrentUser();
            localStorage.setItem('user', JSON.stringify(userData));
            // Trigger coins update event for navbar
            window.dispatchEvent(new Event('coinsUpdated'));
          } catch (err) {
            console.error('Error fetching updated user data:', err);
          }
        }
      }

      // Store contest ID and redirect to play contest
      sessionStorage.setItem('currentContestId', contestId);
      router.push(`/contest/${contestId}/play`);
    } catch (err: any) {
      console.error('Error joining contest:', err);
      if (err.response?.data?.error === 'Insufficient coins') {
        setShowInsufficientCoinsModal(true);
      } else if (err.response?.data?.error === 'You have already joined this contest') {
        // Already joined, just proceed to play
        sessionStorage.setItem('currentContestId', contestId);
        router.push(`/contest/${contestId}/play`);
      } else {
        alert(err.response?.data?.error || 'Failed to join contest. Please try again.');
      }
    } finally {
      setJoining(false);
    }
  };

  const handlePlayAsGuest = async () => {
    if (!contestId || !contest) return;
    
    // Guest user - start quiz directly
    try {
      setJoining(true);
      
      // Check if contest has a joining fee
      if (contest.joining_fee > 0) {
        const guestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
        if (guestCoins < contest.joining_fee) {
          setShowInsufficientCoinsModal(true);
          setJoining(false);
          return;
        }
        // Deduct from guest coins
        const newGuestCoins = guestCoins - contest.joining_fee;
        localStorage.setItem('guestCoins', newGuestCoins.toString());
        // Trigger coins update event for navbar
        window.dispatchEvent(new Event('coinsUpdated'));
      }
      
      // Store contest ID and redirect to play contest
      sessionStorage.setItem('currentContestId', contestId);
      router.push(`/contest/${contestId}/play`);
    } catch (err) {
      console.error('Error starting as guest:', err);
      alert('Failed to start contest. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleJoinQuizwala = () => {
    // Redirect to login with return URL
    const returnUrl = `/contest/${contestId}/rules`;
    router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  if (loading) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] flex items-center justify-center p-5" style={{
          boxShadow: '0px 0px 2px 0px #FFF6D9'
        }}>
          <div className="text-[#FFF6D9] text-lg">Loading contest rules...</div>
        </div>
        <Footer />
      </>
    );
  }

  if (error || !contest) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] flex items-center justify-center p-5" style={{
          boxShadow: '0px 0px 2px 0px #FFF6D9'
        }}>
          <div className="text-center">
            <p className="text-red-400 text-lg mb-4">{error || 'Contest not found'}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-yellow-400 text-[#0D0009] px-6 py-3 rounded-xl font-bold hover:bg-yellow-500 relative overflow-hidden"
            >
              <span className="relative z-10">Go Back</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const totalQuestions = contest?.contest_question_count || 5;
  const totalSeconds = contest?.duration || 50;
  const positiveMarking = contest?.marking || 20;
  const negativeMarking = contest?.negative_marking || 10;
  const secondsPerQuestion = totalQuestions > 0 ? Math.floor(totalSeconds / totalQuestions) : 10;


  return (
    <>
      <SEOHead 
        title="Contest Rules - Quizwala Contest Guidelines"
        description="Read the rules and guidelines for Quizwala contests. Learn about entry fees, duration, scoring, prizes, and how to participate in quiz contests."
        keywords="contest rules, quiz rules, contest guidelines, quiz contest rules, contest instructions"
      />
      <DashboardNav />
      <div className="min-h-screen flex flex-col bg-[#0D0009]" style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="flex-1 pb-20 ">
          <div className="max-w-md mx-auto">
            {/* Welcome Section */}
            <div className="text-center mb-6">
              <p className="text-yellow-400 text-lg font-bold mb-1">WELCOME</p>
              <p className="text-[#FFF6D9] text-md font-bold">{`QuizWala presents ${contest?.name}` || 'QUIZWALA'}</p>
            </div>

            {/* Main Card */}
            <div className="bg-[#0D0009] rounded-xl p-4 mb-6 border border-[#FFF6D9]/20 mx-5" style={{
              boxShadow: '0px 0px 2px 0px #FFF6D9'
            }}>
              <div className="flex items-start gap-3">
                {/* Left side - Icon */}
                <div className="flex-shrink-0 w-[90px] flex flex-col overflow-hidden">
                  {/* Inner Box - Dark Top Section with Icon */}
                  <div className="bg-[#0D0009] rounded-t-xl p-2 flex items-center justify-center border border-[#FFF6D9]/30 border-b-0">
                    <div className="w-10 h-10 flex items-center justify-center">
                      {contest.contestImage ? (
                        <img
                          src={getImageUrl(contest.contestImage)}
                          alt={contest.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const img = e.currentTarget;
                            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                            const filename = contest.contestImage;
                            const triedFallback = img.dataset.triedFallback === 'true';

                            if (filename && !filename.includes('/') && !triedFallback) {
                              img.dataset.triedFallback = 'true';
                              if (img.src.includes('/uploads/categories/')) {
                                img.src = `${baseUrl}/uploads/contests/${filename}`;
                              } else {
                                img.src = `${baseUrl}/uploads/categories/${filename}`;
                              }
                            } else {
                              img.style.display = 'none';
                            }
                          }}
                        />
                      ) : (
                        <svg className="w-10 h-10 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  {/* Inner Box - Bottom Section with Contest Name */}
                  <div className="bg-[#FFF6D9] rounded-b-xl px-2 py-2 flex items-center justify-center border border-[#FFF6D9]/30 border-t-0" style={{ minHeight: '36px' }}>
                    <p className="text-[#0D0009] font-semibold text-[10px] text-center leading-tight line-clamp-2 overflow-hidden">
                      {contest.name}
                    </p>
                  </div>
                </div>

                {/* Right side - Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[#FFF6D9] text-base font-bold mb-2">Play Quiz and Win</p>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <img src="/coin.svg" alt="Coins" className="w-5 h-5 flex-shrink-0" />
                    <span className="text-yellow-400 text-lg font-bold">{(contest?.winCoins || 24000).toLocaleString()}</span>
                    <span className="text-[#FFF6D9] text-base">COINS</span>
                  </div>
                  <p className="text-[#FFF6D9] text-xs mb-1">Join and save the coins you win!</p>
                  <p className="text-[#FFF6D9] text-xs">Wish you good luck!</p>
                </div>
              </div>
            </div>
            </div>
            {/* Advertisement Section - Between rules and action buttons for optimal visibility */}
            <div className="bg-[#0D0009]   mb-5  border-b border-[#FFF6D9]/20  h-full" style={{
              boxShadow: '0px 0px 2px 0px #FFF6D9'
            }}>
            <p className="text-center text-[#FFF6D9] text-sm mb-2">ADVERTISEMENT</p>
            <AdsenseAd />
          </div>
            {/* Rules Section */}
            <div className="m-5">
              <h2 className="text-[#FFF6D9] text-lg font-bold mb-4">Rules are Simple:</h2>
              <ul className="space-y-2 text-[#FFF6D9] text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#FFF6D9] mt-1">•</span>
                  <span>{totalQuestions} Questions, {totalSeconds} seconds. Right Answer +{positiveMarking}, Wrong Answer -{negativeMarking}.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FFF6D9] mt-1">•</span>
                  <span>{totalSeconds}-Seconds countdown for the quiz.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FFF6D9] mt-1">•</span>
                  <span>Winner is announced at the end of the quiz.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FFF6D9] mt-1">•</span>
                  <span>Winner gets bragging rights and their opponent's first born</span>
                </li>
              </ul>
            </div>

            
            {/* <div className="mb-6">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="flex-1 h-px bg-white/30"></div>
                <span className="text-white text-sm">ADVERTISEMENT</span>
                <div className="flex-1 h-px bg-white/30"></div>
              </div>
              <div className="bg-white rounded-xl p-4">
                <h3 className="text-[#392C6E] text-lg font-bold mb-4">FREE DIAMONDS IN FREE FIRE!</h3>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <button className="bg-gray-200 rounded-lg p-3 border-2 border-dashed border-yellow-500 flex items-center justify-center gap-2">
                    <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 2L2 7v15c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-4-5H6zm6 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                    </svg>
                    <span className="text-gray-700 font-bold">500</span>
                  </button>
                  <button className="bg-gray-200 rounded-lg p-3 border-2 border-dashed border-gray-400 flex items-center justify-center gap-2">
                    <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 2L2 7v15c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-4-5H6zm6 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                    </svg>
                    <span className="text-gray-700 font-bold">1800</span>
                  </button>
                  <button className="bg-gray-200 rounded-lg p-3 border-2 border-dashed border-gray-400 flex items-center justify-center gap-2">
                    <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 2L2 7v15c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-4-5H6zm6 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                    </svg>
                    <span className="text-gray-700 font-bold">15000</span>
                  </button>
                  <button className="bg-gray-200 rounded-lg p-3 border-2 border-dashed border-gray-400 flex items-center justify-center gap-2">
                    <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 2L2 7v15c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-4-5H6zm6 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                    </svg>
                    <span className="text-gray-700 font-bold">60000</span>
                  </button>
                </div>
                <button className="w-full bg-gray-200 rounded-lg p-3 border-2 border-dashed border-red-500 flex items-center justify-center gap-2">
                  <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 2L2 7v15c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-4-5H6zm6 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                  </svg>
                  <span className="text-gray-700 font-bold">+99999</span>
                </button>
              </div>
            </div> */}
          
        </div>

        {/* Sticky Bottom Buttons */}
        <div className="sticky bottom-0 w-full bg-[#0D0009] pt-4 border-t border-[#FFF6D9]/20 shadow-2xl z-50" style={{
          boxShadow: '0px 0px 2px 0px #FFF6D9'
        }}>
          <div className="max-w-md mx-auto p-5 pb-8 relative z-50">
            {isLoggedIn ? (
              // Logged in user - only show "START QUIZ" button
              <button
                onClick={handleStartContest}
                disabled={joining}
                className="w-full h-[56px] bg-yellow-400 text-[#0D0009] rounded-xl font-bold text-lg hover:bg-yellow-500 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden z-50"
                style={{ position: 'relative', zIndex: 50 }}
              >
                <span className="relative z-10">{joining ? 'Starting...' : 'START QUIZ'}</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>
            ) : (
              // Not logged in - show both buttons
              <div className="flex gap-3 relative z-50">
                <button
                  onClick={handleJoinQuizwala}
                  className="flex-1 h-[56px] bg-yellow-400 text-[#0D0009] rounded-xl font-bold text-lg hover:bg-yellow-500 transition-colors shadow-lg relative overflow-hidden z-50"
                  style={{ position: 'relative', zIndex: 50 }}
                >
                  <span className="relative z-10">JOIN QUIZWALA</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
                </button>
                <button
                  onClick={handlePlayAsGuest}
                  disabled={joining}
                  className="flex-1 h-[56px] bg-transparent border-2 border-[#FFF6D9] text-[#FFF6D9] rounded-xl font-semibold hover:bg-[#FFF6D9]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative z-50"
                  style={{ position: 'relative', zIndex: 50 }}
                >
                  {joining ? 'Starting...' : 'PLAY AS GUEST'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />

      {/* Insufficient Coins Modal */}
      {showInsufficientCoinsModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D0009] rounded-xl p-6 max-w-md w-full relative border border-[#FFF6D9]/20" style={{
            boxShadow: '0px 0px 2px 0px #FFF6D9'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowInsufficientCoinsModal(false)}
              className="absolute top-4 right-4 text-[#FFF6D9] hover:text-[#FFF6D9]/70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="relative w-24 h-24">
                {/* Yellow Coin with Dollar Sign */}
                <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center absolute top-0 left-0">
                  <svg className="w-10 h-10 text-[#0D0009]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                  </svg>
                </div>
                {/* Red Circle with Diagonal Line Overlay */}
                <div className="w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center absolute top-0 left-0">
                  <div className="w-14 h-1.5 bg-red-500 transform rotate-45 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-yellow-400 text-3xl font-bold text-center mb-4 uppercase">OOPS!</h2>

            {/* Message */}
            <p className="text-[#FFF6D9] text-center mb-6 text-lg">
              You don't have enough coins to play this contest.
            </p>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Watch Video Button */}
              <button
                onClick={async () => {
                  // TODO: Implement video ad watching logic
                  // For now, award coins and close modal
                  const storedUser = localStorage.getItem('user');
                  const coinsToAward = 100;
                  
                  if (storedUser) {
                    try {
                      // Logged in user - use backend API to award coins
                      await authApi.awardCoins(coinsToAward, 'Earned coins from watching video ad', contestId);
                      const userData = await authApi.getCurrentUser();
                      localStorage.setItem('user', JSON.stringify(userData));
                      window.dispatchEvent(new Event('coinsUpdated'));
                    } catch (err) {
                      console.error('Error awarding coins:', err);
                      // Fallback to local update
                      const user = JSON.parse(storedUser);
                      const updatedUser = { ...user, coins: (user.coins || 0) + coinsToAward };
                      localStorage.setItem('user', JSON.stringify(updatedUser));
                      window.dispatchEvent(new Event('coinsUpdated'));
                    }
                  } else {
                    // Guest user
                    const guestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
                    const newGuestCoins = guestCoins + coinsToAward;
                    localStorage.setItem('guestCoins', newGuestCoins.toString());
                    window.dispatchEvent(new Event('coinsUpdated'));
                  }
                  setShowInsufficientCoinsModal(false);
                }}
                className="w-full bg-yellow-400 text-[#0D0009] rounded-xl py-4 px-6 font-bold text-lg hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2 relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Watch Video (Get 100 Coins)
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>

              {/* Spin Wheel Button */}
              <button
                onClick={() => {
                  setShowInsufficientCoinsModal(false);
                  router.push('/spin-wheel');
                }}
                className="w-full bg-purple-500 text-[#FFF6D9] rounded-xl py-4 px-6 font-bold text-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
                </svg>
                Spin Wheel (Cost: 10 Coins)
              </button>
            </div>

            {/* Instruction Text */}
            <p className="text-[#FFF6D9] text-center text-sm mt-4">
              Choose an option above to earn coins and play the contest
            </p>
          </div>
        </div>
      )}
    </>
  );
}


