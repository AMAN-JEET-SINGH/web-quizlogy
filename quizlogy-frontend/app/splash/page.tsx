'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashPage() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState<boolean | null>(null); // null = checking
  const [countdown, setCountdown] = useState(3);
  const [number1, setNumber1] = useState(0);
  const [number2, setNumber2] = useState(0);
  const [number3, setNumber3] = useState(0);

  // Target values
  const target1 = 30;
  const target2 = 10; // 10M+
  const target3 = 180; // 180K+

  // If user has seen splash in the last 1 hour, skip splash and go to intro
  useEffect(() => {
    const splashLastSeen = localStorage.getItem('splashLastSeen');
    const oneHourInMs = 60 * 60 * 1000;
    if (splashLastSeen) {
      const elapsed = Date.now() - parseInt(splashLastSeen, 10);
      if (elapsed < oneHourInMs) {
        setShowSplash(false);
        router.push('/intro');
        return;
      }
    }
    localStorage.setItem('splashLastSeen', Date.now().toString());
    setShowSplash(true);
  }, [router]);

  useEffect(() => {
    // Animate numbers for 1 second
    const duration = 1000; // 1 second
    const steps = 60; // 60 steps for smooth animation
    const stepDuration = duration / steps;

    let step1 = 0;
    let step2 = 0;
    let step3 = 0;

    const animateNumbers = () => {
      const interval = setInterval(() => {
        step1++;
        step2++;
        step3++;

        // Ease-out animation
        const progress1 = Math.min(step1 / steps, 1);
        const progress2 = Math.min(step2 / steps, 1);
        const progress3 = Math.min(step3 / steps, 1);

        // Ease-out function
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

        setNumber1(Math.floor(easeOut(progress1) * target1));
        setNumber2(Math.floor(easeOut(progress2) * target2));
        setNumber3(Math.floor(easeOut(progress3) * target3));

        if (step1 >= steps && step2 >= steps && step3 >= steps) {
          // Ensure final values
          setNumber1(target1);
          setNumber2(target2);
          setNumber3(target3);
          clearInterval(interval);
        }
      }, stepDuration);
    };

    animateNumbers();
  }, []);

  useEffect(() => {
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-redirect after 3 seconds
    const redirectTimeout = setTimeout(() => {
      router.push('/intro');
    }, 3000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(redirectTimeout);
    };
  }, [router]);

  const handleSkip = () => {
    router.push('/intro');
  };

  // Don't render splash if user saw it within last hour (redirecting to intro)
  if (showSplash === false) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FFF6D9]">
        <p className="text-gray-600">Taking you to the quiz...</p>
      </div>
    );
  }

  // Brief check while we decide whether to show splash
  if (showSplash === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FFF6D9]" />
    );
  }

  return (
    <div className="h-screen relative overflow-hidden flex flex-col" style={{
      backgroundColor: '#FFF6D9',
      backgroundImage: 'url(/splash-bg.svg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      {/* Background Geometric Shapes - More scattered */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.2 }}>
        {/* Circles - More variety */}
        <div className="absolute top-8 left-8 w-16 h-16 rounded-full bg-yellow-400"></div>
        <div className="absolute top-32 right-16 w-12 h-12 rounded-full bg-blue-400"></div>
        <div className="absolute top-64 left-1/4 w-20 h-20 rounded-full bg-yellow-300"></div>
        <div className="absolute bottom-48 left-16 w-18 h-18 rounded-full bg-blue-300"></div>
        <div className="absolute bottom-24 right-8 w-14 h-14 rounded-full bg-yellow-400"></div>
        <div className="absolute top-1/2 left-12 w-10 h-10 rounded-full bg-blue-300"></div>
        <div className="absolute top-1/3 right-1/4 w-8 h-8 rounded-full bg-yellow-300"></div>
        
        {/* Triangles */}
        <div className="absolute top-48 left-1/3 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent border-b-yellow-400"></div>
        <div className="absolute bottom-64 right-1/3 w-0 h-0 border-l-[18px] border-r-[18px] border-b-[30px] border-l-transparent border-r-transparent border-b-blue-400"></div>
        <div className="absolute top-1/4 right-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-yellow-300"></div>
        
        {/* Rectangles/Squares */}
        <div className="absolute top-1/3 right-1/3 w-14 h-7 bg-yellow-400 transform rotate-45"></div>
        <div className="absolute bottom-1/3 left-1/4 w-10 h-5 bg-blue-400 transform -rotate-45"></div>
        <div className="absolute top-2/3 left-1/2 w-12 h-6 bg-yellow-300 transform rotate-12"></div>
        <div className="absolute bottom-1/4 right-1/5 w-8 h-4 bg-blue-300 transform -rotate-12"></div>
      </div>

      <div className="relative z-10 h-full flex flex-col justify-between px-3 sm:px-4 py-2 sm:py-3">
        {/* Top Section */}
        <div className="flex flex-col items-center flex-shrink-0">
          {/* Logo */}
          <div className="mb-1 sm:mb-2">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-2 sm:border-3 border-white bg-white flex items-center justify-center shadow-lg">
              <img 
                src="/logo.svg" 
                alt="Quiz Website Logo" 
                className="w-full h-full object-contain p-1.5"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  if (target.parentElement) {
                    target.parentElement.innerHTML = '<span class="text-2xl sm:text-3xl">❓</span>';
                  }
                }}
              />
            </div>
          </div>

          {/* Primary Heading */}
          <h1 className="text-center text-lg sm:text-xl md:text-2xl font-bold text-[#0D0009] mb-2 sm:mb-3 px-2">
            QUIZZES FOR ALL INTERESTS!
          </h1>

          {/* Statistical Feature Cards */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-2 sm:mb-3 w-full max-w-4xl">
            {/* Card 1 */}
            <div className="bg-[#0D0009] rounded-xl border-4 border-[#FFCE01] px-2 sm:px-3 py-1.5 sm:py-2 text-center flex-1 min-w-[90px] max-w-[120px]">
              <div className="text-lg sm:text-2xl md:text-3xl font-bold mb-0.5" style={{ color: '#FFCE01' }}>
                {number1}+
              </div>
              <div className="text-[8px] sm:text-[9px] text-white leading-tight">
                Unique Quiz Categories
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#0D0009] rounded-xl border-4 border-[#FFCE01] px-2 sm:px-3 py-1.5 sm:py-2 text-center flex-1 min-w-[90px] max-w-[120px]">
              <div className="text-lg sm:text-2xl md:text-3xl font-bold mb-0.5" style={{ color: '#FFCE01' }}>
                {number2}M+
              </div>
              <div className="text-[8px] sm:text-[9px] text-white leading-tight">
                Unique Quiz Categories
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#0D0009] rounded-xl border-4 border-[#FFCE01] px-2 sm:px-3 py-1.5 sm:py-2 text-center flex-1 min-w-[90px] max-w-[120px]">
              <div className="text-lg sm:text-2xl md:text-3xl font-bold mb-0.5" style={{ color: '#FFCE01' }}>
                {number3}K+
              </div>
              <div className="text-[8px] sm:text-[9px] text-white leading-tight">
                Unique Quiz Categories
              </div>
            </div>
          </div>

          {/* Secondary Text */}
          <div className="text-center mb-1 sm:mb-2 px-4">
            <p className="text-xs sm:text-sm md:text-base text-[#0D0009] mb-0.5">Show Your Knowledge</p>
            <p className="text-sm sm:text-base md:text-lg font-bold text-[#0D0009] leading-tight">
              Play GK, Sports, Movies, Science & Mega Quizzes to Win
            </p>
          </div>
        </div>

        {/* Middle Section - Dashboard and Contest Preview */}
        <div className="flex justify-center flex-1 items-center flex-shrink-0 min-h-0 relative">
          <div className="relative" style={{ 
            maxWidth: '350px', 
            width: '90%',
            maxHeight: '80%'
          }}>
            {/* Dashboard SVG (Phone/App UI) */}
            <div
              className="relative z-10  overflow-hidden flex items-center justify-center"
              
            >
              <img 
                src="/Dashboard.svg" 
                alt="Quizwala Dashboard" 
                className="w-[80%] h-auto rounded-4xl"
                style={{ 
                  maxHeight: '90%', 
                  objectFit: 'contain',
                  display: 'block',
                  borderTop: '6px solid #FFCE01',
                  borderLeft: '6px solid #FFCE01',
                  borderRight: '6px solid #FFCE01',
                  borderBottom: 'none'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  if (target.parentElement) {
                    target.parentElement.innerHTML = `
                      <div class="w-full h-64 bg-[#0D0009] rounded-xl flex items-center justify-center text-white">
                        <p class="text-sm">Dashboard Image</p>
                      </div>
                    `;
                  }
                }}
              />
            </div>
            {/* Contest SVG (Overlapping the bottom of dashboard) */}
            <div 
              className="absolute left-1/2 z-20" 
              style={{
                width: '100%',
                maxWidth: 'calc(100% + 100px)',
                top: '35%',
                transform: 'translateX(-50%)',
                // background: 'linear-gradient(180deg, #0D0009 0%, rgba(13, 0, 9, 0) 100%)'
              }}
            >
              <img 
                src="/contest.svg" 
                alt="Contest Card" 
                className="w-full h-auto"
                style={{ maxHeight: '150px', objectFit: 'contain' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom Section - Countdown and Skip */}
        <div className="flex justify-between items-center pt-2 px-2 sm:px-1 flex-shrink-0 pb">
          <p className="text-xs sm:text-sm text-[#0D0009] font-medium">
            Redirecting in {countdown} Second{countdown !== 1 ? 's' : ''}...
          </p>
          <button
            onClick={handleSkip}
            className="text-xs sm:text-sm text-[#0D0009] underline hover:no-underline cursor-pointer font-medium"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
