'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SEOHead } from '@/components/SEOHead';
import { authApi, User, wheelApi } from '@/lib/api';

interface Prize {
  label: string;
  value: number;
  coinImage: string;
}

export default function SpinWheelPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ label: string; value: number } | null>(null);
  const [userCoins, setUserCoins] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [showMessage, setShowMessage] = useState(false);

  // 8 parts: coin10, coin20, coin100, coin500, coin30, coin50, zerocoin, zerocoin
  const prizes: Prize[] = [
    { label: '10', value: 10, coinImage: '/coin10.png' },
    { label: '20', value: 20, coinImage: '/coin20.svg' },
    { label: '100', value: 100, coinImage: '/coin100.svg' },
    { label: '500', value: 500, coinImage: '/coin500.svg' },
    { label: '30', value: 30, coinImage: '/coin30.png' },
    { label: '50', value: 50, coinImage: '/coint50.svg' },
    { label: '0', value: 0, coinImage: '/zerocoin.png' },
    { label: '0', value: 0, coinImage: '/zerocoin.png' },
  ];

  const maxDailySpins = 3;
  const [spinsRemaining, setSpinsRemaining] = useState(maxDailySpins);
  const anglePerPrize = 360 / prizes.length;

  // Get today's date string for tracking daily spins
  const getTodayString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  };

  // Check and reset daily spins
  const checkDailySpins = () => {
    const storedDate = localStorage.getItem('spinDate');
    const storedSpins = localStorage.getItem('spinsRemaining');
    const today = getTodayString();

    if (storedDate !== today) {
      // New day, reset spins
      localStorage.setItem('spinDate', today);
      localStorage.setItem('spinsRemaining', maxDailySpins.toString());
      setSpinsRemaining(maxDailySpins);
    } else if (storedSpins) {
      setSpinsRemaining(parseInt(storedSpins));
    }
  };
  
  // Helper function to get which prize is at the pointer (top position)
  const getPrizeAtPointer = (currentRotation: number): number => {
    // Normalize rotation to 0-360
    const normalizedRotation = currentRotation % 360;
    if (normalizedRotation < 0) normalizedRotation + 360;
    
    // Pointer is at top (0 degrees in our system, which is 270° or -90° in standard coordinates)
    // Each coin is positioned at: (index * anglePerPrize + anglePerPrize / 2) - 68
    // When wheel rotates, coin's absolute angle = coinAngle + rotation
    
    // Find which coin is closest to the pointer
    let minDiff = 360;
    let closestIndex = 0;
    
    for (let i = 0; i < prizes.length; i++) {
      const coinAngleFromXAxis = (i * anglePerPrize + anglePerPrize / 2) - 68;
      const coinAngleFromTop = (coinAngleFromXAxis + 90 + 360) % 360;
      const coinAbsoluteAngle = (coinAngleFromTop + normalizedRotation) % 360;
      
      // Distance from pointer (0 degrees)
      const diff = Math.min(coinAbsoluteAngle, 360 - coinAbsoluteAngle);
      
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  };

  useEffect(() => {
    checkAuth();
    checkDailySpins();

    // Listen for coin updates from other parts of the app
    const handleCoinsUpdate = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          const coins = parsedUser.coins || parsedUser.coin || 0;
          setUserCoins(coins);
          console.log('Coins updated from event:', coins);
        } catch (err) {
          console.error('Error parsing user:', err);
        }
      }
    };
    
    // Refresh coins when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            const coins = parsedUser.coins || parsedUser.coin || 0;
            setUserCoins(coins);
            console.log('Coins refreshed on visibility change:', coins);
          } catch (err) {
            console.error('Error parsing user:', err);
          }
        }
      }
    };
    
    window.addEventListener('coinsUpdated', handleCoinsUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('coinsUpdated', handleCoinsUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const checkAuth = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          // Set coins from localStorage first (immediate display)
          const coins = parsedUser.coins || parsedUser.coin || 0;
          setUserCoins(coins);
          console.log('Initial coins from localStorage:', coins, parsedUser);
          
          // Then try to fetch latest from API
          try {
            const userData = await authApi.getCurrentUser();
            setUser(userData);
            // Update coins from API response - only if API returns a valid number
            const apiCoins = userData.coins;
            console.log('Coins from API:', apiCoins, 'User data:', userData);
            if (apiCoins !== undefined && apiCoins !== null && typeof apiCoins === 'number') {
              setUserCoins(apiCoins);
              // Update localStorage with API data
              localStorage.setItem('user', JSON.stringify(userData));
            } else {
              // If API doesn't return coins, keep localStorage value and update user object
              const updatedUserData = { ...userData, coins: coins };
              localStorage.setItem('user', JSON.stringify(updatedUserData));
            }
          } catch (err) {
            console.error('Error fetching user:', err);
            // If API fails, keep using localStorage data
          }
        } catch (err) {
          console.error('Error parsing stored user:', err);
          setUserCoins(0);
        }
      } else {
        const guestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
        setUserCoins(guestCoins);
      }
    } catch (err) {
      console.error('Error checking auth:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSpin = async () => {
    if (spinning) return;

    const storedUser = localStorage.getItem('user');
    const isGuest = !storedUser;

    if (isGuest) {
      alert('Please sign in to spin the wheel.');
      router.push('/login');
      return;
    }

    // Check daily spin limit
    if (spinsRemaining <= 0) {
      alert('You have used all your spins for today. Come back tomorrow for 3 more free spins!');
      return;
    }

    try {
      setSpinning(true);
      setResult(null);
      setShowMessage(false);

      // Decrement spins remaining
      const newSpinsRemaining = spinsRemaining - 1;
      setSpinsRemaining(newSpinsRemaining);
      localStorage.setItem('spinsRemaining', newSpinsRemaining.toString());

      // Randomly select a prize
      const randomIndex = Math.floor(Math.random() * prizes.length);
      const selectedPrize = prizes[randomIndex];

      // Calculate rotation to land on selected prize
      // Pointer is at top (0 degrees), so we need to rotate to position the prize at the top
      // Get current normalized rotation (0-360)
      const currentNormalizedRotation = rotation % 360;
      
      // Calculate the actual angle where the coin is positioned (matching coin positioning logic)
      // Coins are positioned at: (index * anglePerPrize + anglePerPrize / 2) - 68
      // This gives us the angle from the positive x-axis (right side)
      const coinAngleFromXAxis = (randomIndex * anglePerPrize + anglePerPrize / 2) - 68;
      
      // Convert to angle from top (0 degrees at top, clockwise)
      // In standard coordinates: 0° = right, 90° = bottom, 180° = left, 270° = top
      // We need: 0° = top, 90° = right, 180° = bottom, 270° = left
      // So: top = 270° in standard, or -90° from right
      // Coin angle from top = coinAngleFromXAxis + 90
      const coinAngleFromTop = coinAngleFromXAxis + 90;
      
      // To bring this coin to the top (0 degrees), we need to rotate the wheel
      // so that the coin's position becomes 0
      // If coin is at angle X from top, we need to rotate by -X (or 360-X)
      let targetAngle = (360 - coinAngleFromTop) % 360;
      if (targetAngle < 0) {
        targetAngle += 360;
      }
      
      const extraRotations = 5; // 5 full rotations
      
      // Calculate how much we need to rotate from current position
      let rotationNeeded = targetAngle - currentNormalizedRotation;
      if (rotationNeeded < 0) {
        rotationNeeded += 360;
      }
      
      // Add extra rotations and calculate total
      const totalRotation = rotation + (360 * extraRotations) + rotationNeeded;

      // Update rotation state (this will trigger the animation via the style prop)
      setRotation(totalRotation);

      // Show result after animation and update coins with prize
      setTimeout(async () => {
        // Verify which prize is actually at the pointer
        const actualPrizeIndex = getPrizeAtPointer(totalRotation);
        const actualPrize = prizes[actualPrizeIndex];

        // Use the actual prize at pointer, not the randomly selected one
        setResult(actualPrize);
        setShowMessage(true);

        // Add prize coins to user's balance (free spin, so just add the prize)
        if (user && actualPrize.value > 0) {
          try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
              const parsedUser = JSON.parse(storedUser);
              const currentCoins = parsedUser.coins || parsedUser.coin || 0;

              // Add prize to current coins
              const finalCoins = currentCoins + actualPrize.value;

              setUserCoins(finalCoins);

              // Update user in localStorage
              const updatedUser = { ...parsedUser, coins: finalCoins };
              localStorage.setItem('user', JSON.stringify(updatedUser));
              setUser(updatedUser);

              // Save spin history locally
              try {
                const spinHistory = JSON.parse(localStorage.getItem('spinHistory') || '[]');
                const newSpinRecord = {
                  id: Date.now().toString(),
                  timestamp: new Date().toISOString(),
                  cost: 0,
                  prize: actualPrize.value,
                  prizeLabel: actualPrize.label,
                  coinsBefore: currentCoins,
                  coinsAfter: finalCoins,
                };
                spinHistory.unshift(newSpinRecord);
                if (spinHistory.length > 100) {
                  spinHistory.pop();
                }
                localStorage.setItem('spinHistory', JSON.stringify(spinHistory));
              } catch (err) {
                console.error('Error saving spin history:', err);
              }

              window.dispatchEvent(new Event('coinsUpdated'));
            }
          } catch (err) {
            console.error('Error adding prize coins:', err);
          }
        } else if (user) {
          // Even if no prize, save the spin history
          try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
              const parsedUser = JSON.parse(storedUser);
              const currentCoins = parsedUser.coins || parsedUser.coin || 0;

              const spinHistory = JSON.parse(localStorage.getItem('spinHistory') || '[]');
              const newSpinRecord = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                cost: 0,
                prize: 0,
                prizeLabel: '0',
                coinsBefore: currentCoins,
                coinsAfter: currentCoins,
              };
              spinHistory.unshift(newSpinRecord);
              if (spinHistory.length > 100) {
                spinHistory.pop();
              }
              localStorage.setItem('spinHistory', JSON.stringify(spinHistory));
            }
          } catch (err) {
            console.error('Error saving spin history:', err);
          }
        }

        // Keep rotation cumulative (don't normalize) so coins stay in position
        setSpinning(false);
      }, 3000);
    } catch (err) {
      console.error('Error:', err);
      setSpinning(false);
    }
  };

  if (loading) {
    return (
      <>
        <DashboardNav />
        <LoadingScreen message="Loading spin wheel..." fullPage />
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEOHead 
        title="Spin the Wheel - Win Coins & Prizes | Quizwala"
        description="Spin the wheel and win exciting prizes on Quizwala! Use your coins to spin and get a chance to win bonus coins, multipliers, and special rewards."
        keywords="spin wheel, win prizes, quiz wheel, coin wheel, quiz rewards, spin to win"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#0D0009] flex flex-col" style={{ boxShadow: '0px 0px 2px 0px #FFF6D9' }}>
        <div className="container mx-auto px-4 sm:px-6 py-4 flex-1 pb-20">
          {/* Top Banner */}
          <div className="relative rounded-2xl overflow-hidden mb-4" style={{ minHeight: '140px' }}>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'url(/bg-quiz.svg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            />
            <div className="relative z-10 flex items-center justify-center h-full py-6">
              <img src="/spin.svg" alt="Spin" className="w-20 h-20 object-contain opacity-90" />
            </div>
            <div
              className="relative z-10 px-6 pb-3"
              style={{
                background: 'linear-gradient(180deg, rgba(13, 0, 9, 0) 0%, #0D0009 100%)'
              }}
            >
              <h1 className="text-[#FFF6D9] text-xl sm:text-2xl md:text-3xl font-bold mb-1">
                Spin the Wheel
              </h1>
              <p className="text-[#FFF6D9]/80 text-sm sm:text-base">
                3 free spins daily - win coins!
              </p>
            </div>
          </div>

          {/* Wheel Container */}
          <div
            className="rounded-2xl p-6 mb-6 border border-[#FFF6D9]/20"
            style={{
              backgroundImage: 'url(/Maskgroup.svg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              boxShadow: '0px 0px 2px 0px #FFF6D9'
            }}
          >
            {/* Result Message */}
            {showMessage && result && (
              <div className="mt-4 px-4 py-3 rounded-xl text-center border border-[#FFF6D9]/30 bg-[#0D0009]/80">
                {result.value > 0 ? (
                  <>
                    <p className="text-[#FFF6D9] text-xl font-bold mb-1">🎉 Congratulations! 🎉</p>
                    <p className="text-[#FFF6D9]">You won <span className="font-bold text-yellow-400">{result.value} coins</span>!</p>
                  </>
                ) : (
                  <>
                    <p className="text-[#FFF6D9] text-xl font-bold mb-1">😔 Oops! Try Again</p>
                    <p className="text-[#FFF6D9]/80">Better luck next time!</p>
                  </>
                )}
              </div>
            )}
            <div className="relative flex flex-col items-center">
              <p className="text-[#FFF6D9]/90 text-sm mb-4">
                Spins remaining today: <span className="font-bold text-yellow-400">{spinsRemaining}/{maxDailySpins}</span>
                <span className="text-[#FFF6D9]/70 ml-2">·</span>
                <span className="ml-2">
                  <img src="/coin.svg" alt="" className="w-4 h-4 inline align-middle mr-1" />
                  <span className="font-bold text-[#FFF6D9]">{userCoins.toLocaleString()}</span>
                </span>
              </p>
              {/* Wheel */}
              <div className="relative w-80 h-80 mb-8">
                {/* Pointer at top */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 z-30">
                  <div className="w-0 h-0 border-l-[20px] border-r-[20px] border-t-[40px] border-l-transparent border-r-transparent border-t-[#FFD602]"></div>
                </div>

                {/* Wheel Base with rotating container */}
                <div
                  ref={wheelRef}
                  className={`w-full h-full relative ${spinning ? 'transition-transform duration-[3000ms] ease-out' : ''}`}
                  style={{
                    transform: `rotate(${rotation}deg)`,
                  }}
                >
                  {/* Wheel Base SVG */}
                  <img 
                    src="/wheel-base.svg" 
                    alt="Wheel Base" 
                    className="w-full h-full absolute inset-0"
                  />
                  
                  {/* Coin Images positioned on wheel */}
                  {prizes.map((prize, index) => {
                    // Calculate angle for center of each segment
                    // Start from top (0 degrees) and offset by half segment width
                    const angle = (index * anglePerPrize + anglePerPrize / 2) - 68; // -90 to start from top
                    const radius = 80; // Distance from center - positioned in middle-outer area of segment
                    const radian = (angle * Math.PI) / 180;
                    const centerX = 160; // Half of 320px (w-80 = 320px)
                    const centerY = 160; // Half of 320px
                    const x = centerX + radius * Math.cos(radian);
                    const y = centerY + radius * Math.sin(radian);
                    
                    return (
                      <div
                        key={index}
                        className="absolute"
                        style={{
                          left: `${x}px`,
                          top: `${y}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <img 
                          src={prize.coinImage} 
                          alt={prize.label} 
                          className="w-13 h-13"
                        />
                      </div>
                    );
                  })}
                </div>
                
                {/* Center Spin Button */}
                <button
                  onClick={handleSpin}
                  disabled={spinning || spinsRemaining <= 0}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-[#FFD602] rounded-full border-4 border-[#FFF6D9]/50 flex items-center justify-center z-20 hover:bg-[#FFE033] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                >
                  <img src="/spin.svg" alt="Spin" className="w-24 h-24" />
                </button>
              </div>

              {/* Bottom Spin Button */}
              <button
                onClick={handleSpin}
                disabled={spinning || spinsRemaining <= 0}
                className="w-full bg-[#FFD602] text-[#0D0009] font-bold py-4 px-12 rounded-xl text-lg sm:text-xl hover:bg-[#FFE033] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] shadow-lg mt-2"
              >
                <span className="relative z-10">
                  {spinning ? 'Spinning...' : spinsRemaining > 0 ? `Spin (${spinsRemaining} left)` : 'No spins left today'}
                </span>
              </button>

            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
