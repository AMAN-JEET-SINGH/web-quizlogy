'use client';

import { useState, useEffect } from 'react';
import { Contest, getImageUrl } from '@/lib/api';
import { isDailyContest, isDailyContestLive, getTimeUntilDailyStart, getTimeUntilDailyEnd, getNextDailyStartTime } from '@/lib/dailyContestUtils';

interface ContestCardProps {
  contest: Contest;
  playerCount?: number;
  onPlayClick?: () => void;
}

// Get icon based on contest name/category
const getContestIcon = (name: string, category: string) => {
  const lowerName = name.toLowerCase();
  const lowerCategory = category.toLowerCase();

  // Cricket
  if (lowerName.includes('cricket') || lowerCategory.includes('cricket')) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute w-10 h-2.5 bg-yellow-400 rounded transform rotate-[25deg] -translate-x-2"></div>
        <div className="absolute w-8 h-2 bg-yellow-500 rounded transform rotate-[25deg] -translate-x-1 translate-y-1"></div>
        <div className="absolute w-3 h-3 bg-orange-500 rounded-full -translate-x-5 -translate-y-2"></div>
      </div>
    );
  }

  // History / General Knowledge
  if (lowerName.includes('history') || lowerName.includes('general') || lowerCategory.includes('history') || lowerCategory.includes('general')) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="w-12 h-16 bg-yellow-400 rounded-lg relative">
          <div className="absolute top-1.5 left-1.5 right-1.5 space-y-0.5">
            <div className="h-0.5 bg-yellow-600 rounded"></div>
            <div className="h-0.5 bg-yellow-600 rounded w-3/4"></div>
            <div className="h-0.5 bg-yellow-600 rounded"></div>
            <div className="h-0.5 bg-yellow-600 rounded w-2/3"></div>
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-white border-2 border-red-500 rounded-full flex items-center justify-center">
            <div className="absolute w-0.5 h-1.5 bg-black -translate-y-0.5"></div>
            <div className="absolute w-1.5 h-0.5 bg-black translate-x-0.5"></div>
          </div>
        </div>
      </div>
    );
  }

  // Image Quiz
  if (lowerName.includes('image') || lowerCategory.includes('image')) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="w-12 h-12 bg-blue-500 rounded relative border-2 border-blue-400">
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-green-500 rounded-b">
            <div className="absolute top-0 left-1/4 w-6 h-6 bg-green-600 rounded-full -translate-y-1/2"></div>
            <div className="absolute top-0 right-1/4 w-4 h-4 bg-green-600 rounded-full -translate-y-1/2"></div>
          </div>
          <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-yellow-300 rounded-full"></div>
        </div>
      </div>
    );
  }

  // Brain Test (default)
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-12 h-10">
        <div className="absolute top-0 left-1.5 w-6 h-4 bg-blue-500 rounded-full"></div>
        <div className="absolute top-0.5 right-1.5 w-5 h-4 bg-green-500 rounded-full"></div>
        <div className="absolute bottom-1.5 left-3 w-4 h-4 bg-yellow-400 rounded-full"></div>
        <div className="absolute bottom-1 right-3 w-4 h-3 bg-red-500 rounded-full"></div>
        <div className="absolute top-2 left-4.5 w-3 h-2 bg-purple-500 rounded-full"></div>
      </div>
    </div>
  );
};

// Calculate time remaining
const getTimeRemaining = (date: string): string => {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return '00:00:00';

  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  // If more than 24 hours, show days and hours
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days}d ${hours}h`;
  }

  // Otherwise show hours:minutes:seconds
  return `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Determine contest status
const getContestStatus = (contest: Contest): 'LIVE' | 'UPCOMING' | 'PAST' | 'DAILY_LIVE' | 'DAILY_UPCOMING' => {
  if (isDailyContest(contest)) {
    const isLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
    return isLive ? 'DAILY_LIVE' : 'DAILY_UPCOMING';
  }

  if (!contest.startDate || !contest.endDate) return 'PAST';
  
  const now = new Date();
  const start = new Date(contest.startDate);
  const end = new Date(contest.endDate);

  if (now < start) return 'UPCOMING';
  if (now > end) return 'PAST';
  return 'LIVE';
};

export const ContestCard = ({ contest, playerCount = 0, onPlayClick }: ContestCardProps) => {
  const status = getContestStatus(contest);
  const isDaily = isDailyContest(contest);
  const isLive = status === 'LIVE' || status === 'DAILY_LIVE';
  const isUpcoming = status === 'UPCOMING' || status === 'DAILY_UPCOMING';
  const isDailyLive = status === 'DAILY_LIVE';
  const isDailyUpcoming = status === 'DAILY_UPCOMING';
  
  const [timeRemaining, setTimeRemaining] = useState(() => {
    if (isDaily) {
      if (isDailyLive) {
        return getTimeUntilDailyEnd(contest.dailyEndTime);
      } else {
        return getTimeUntilDailyStart(contest.dailyStartTime);
      }
    } else {
      if (isLive && contest.endDate) return getTimeRemaining(contest.endDate);
      if (isUpcoming && contest.startDate) return getTimeRemaining(contest.startDate);
    }
    return '';
  });

  const [dailyMessage, setDailyMessage] = useState('');

  // Update countdown every second for live/upcoming contests
  useEffect(() => {
    if (!isLive && !isUpcoming) return;

    const interval = setInterval(() => {
      if (isDaily) {
        if (isDailyLive) {
          const time = getTimeUntilDailyEnd(contest.dailyEndTime);
          setTimeRemaining(time);
          
          // Check if still live
          if (!isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime)) {
            setTimeRemaining('');
            clearInterval(interval);
          }
        } else {
          const time = getTimeUntilDailyStart(contest.dailyStartTime);
          setTimeRemaining(time);
          
          // Check if it's now live
          if (isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime)) {
            setTimeRemaining(getTimeUntilDailyEnd(contest.dailyEndTime));
            clearInterval(interval);
          }
        }
      } else {
        const targetDate = isLive ? contest.endDate : contest.startDate;
        if (!targetDate) {
          clearInterval(interval);
          return;
        }
        const remaining = getTimeRemaining(targetDate);
        setTimeRemaining(remaining);
        
        // If time is up, stop updating
        if (remaining === '00:00:00') {
          clearInterval(interval);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive, isUpcoming, isDaily, isDailyLive, contest.endDate, contest.startDate, contest.dailyStartTime, contest.dailyEndTime]);

  // Set daily message
  useEffect(() => {
    if (isDaily && !isDailyLive && contest.dailyStartTime) {
      const nextStart = getNextDailyStartTime(contest.dailyStartTime);
      if (nextStart) {
        const hours = nextStart.getHours();
        const minutes = nextStart.getMinutes();
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        setDailyMessage(`Come back tomorrow to play daily quiz at ${timeStr}`);
      }
    } else {
      setDailyMessage('');
    }
  }, [isDaily, isDailyLive, contest.dailyStartTime]);

  return (
    <div 
      className="rounded-xl overflow-hidden"
      style={{
        background: '#0D0009',
        boxShadow: '0px 0px 2px 0px #9272FF inset'
      }}
    >
      <div className="flex">
        {/* Left Section - Box in Box: Dark Purple Container with White Bottom Box */}
        <div className="bg-[#0D0009] rounded-l-xl min-w-[34%]  flex flex-col overflow-hidden border-l border-y border-[#564C53]">
          {/* Inner Box with Image and Text */}
          <div 
            className="mt-4 ml-3 mr-1 mb-4 rounded-xl p-3 flex flex-col items-center justify-center"
            style={{
              backgroundColor: contest.categoryBackgroundColor || '#FFF6D9',
            }}
          >
            <div className="w-17  h-17 mt-2 mb-1">
              {contest.contestImage ? (
                <img
                  src={getImageUrl(contest.contestImage)}
                  alt={contest.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                    const filename = contest.contestImage;
                    
                    // Prevent infinite loop - check if we've already tried both folders
                    const hasTriedCategories = img.dataset.triedCategories === 'true';
                    const hasTriedContests = img.dataset.triedContests === 'true';
                    
                    // If first attempt failed and it's just a filename, try the other folder
                    if (!filename.includes('/')) {
                      if (img.src.includes('/uploads/contests/') && !hasTriedCategories) {
                        // First try was contests, now try categories
                        img.dataset.triedContests = 'true';
                        img.dataset.triedCategories = 'true';
                        img.src = `${baseUrl}/uploads/categories/${filename}`;
                      } else if (img.src.includes('/uploads/categories/') && !hasTriedContests) {
                        // First try was categories, now try contests
                        img.dataset.triedCategories = 'true';
                        img.dataset.triedContests = 'true';
                        img.src = `${baseUrl}/uploads/contests/${filename}`;
                      } else {
                        // Both folders tried, give up
                        console.error('❌ ContestCard image failed in both folders:', {
                          contestName: contest.name,
                          originalPath: contest.contestImage
                        });
                        img.style.display = 'none';
                      }
                    }
                  }}
                />
              ) : (
                getContestIcon(contest.name, contest.category)
              )}
            </div>
            <p className="text-[#0D0009] font-semibold text-[11px] sm:text-[13px] text-center leading-tight">
              {contest.name.split(' ').map((word, idx, arr) => (
                <span key={idx}>
                  {word}
                  {idx < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Right Section - Dark Purple Background */}
        <div className="flex-1 bg-[#0D0009] rounded-r-xl p-4 relative border-r border-y  border-[#564C53] min-h-[150px] ">
          {/* Live Indicator (for daily contests when live) */}
          {isDaily && isDailyLive && (
            <div className="absolute top-2 right-1 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white text-[9px] sm:text-xs font-medium">Live</span>
            </div>
          )}
          
          {/* Daily Upcoming Indicator */}
          {isDaily && !isDailyLive && (
            <div className="absolute top-2 right-1 flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-white text-[9px] sm:text-xs font-medium">Upcoming</span>
            </div>
          )}
          
          {/* Live Indicator (for regular contests) */}
          {!isDaily && isLive && (
            <div className="absolute top-2 right-1 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white text-[9px] sm:text-xs font-medium">Live</span>
            </div>
          )}
          
          {/* Upcoming Indicator (for regular contests) */}
          {!isDaily && isUpcoming && (
            <div className="absolute top-2 right-1 flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-white text-[9px] sm:text-xs font-medium">Upcoming</span>
            </div>
          )}

          {/* Prize Information */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white text-xs sm:text-sm">Win up to</span>
            <div className="w-4 h-4 relative">
              <img src={'/coin2.svg'} alt="Win Coins" className="w-full h-full object-contain" />
            </div>
            <span className="text-white font-bold text-sm sm:text-base">{contest.winCoins.toLocaleString()}</span>
          </div>

          {/* Timer */}
          {timeRemaining && (isLive || isUpcoming) && (
            <div className="flex items-center gap-2 mb-1">
              <img src={'/clock1.svg'} alt="Clock" className="w-4 h-4 object-contain opacity-50" />
              <span className="text-[#FFF6D9] opacity-50 text-sm">
                {isDaily 
                  ? (isDailyLive ? `Ends in ${timeRemaining}` : `Starts in ${timeRemaining}`)
                  : (isLive ? `Ends in ${timeRemaining}` : `Starts in ${timeRemaining}`)
                }
              </span>
            </div>
          )}

          {/* Daily Message */}
          {dailyMessage && (
            <div className="mb-2">
              <span className="text-white opacity-70 text-[10px] sm:text-xs italic">{dailyMessage}</span>
            </div>
          )}

          {/* Player Count */}
          <div className="flex items-center gap-2 mb-2">
            <img src={'/timer1.svg'} alt="User" className="w-4 h-4 object-contain opacity-50" />
            <span className="text-[#FFF6D9] opacity-50 text-sm">
              {status === 'PAST' 
                ? `${Math.floor(playerCount / 1000)}k people played`
                : isUpcoming 
                  ? 'Game not started yet' 
                  : `${playerCount} Players playing`
              }
            </span>
          </div>

          {/* Play Button */}
          <button
            onClick={onPlayClick}
            className="w-full md:w-[65%] border-2 border-[#FFF6D9] rounded-lg px-4 py-2 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
          >
            <span className="text-[#FFF6D9] text-xs sm:text-sm font-medium">Play For</span>
            <img src={'/coin2.svg'} alt="Win Coins" className="w-4 h-4 object-contain" />
            <span className="text-[#FFF6D9] font-bold text-xs sm:text-sm">{contest.joining_fee.toLocaleString()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

