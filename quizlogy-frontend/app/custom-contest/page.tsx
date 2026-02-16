'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { questionsApi, Question, contestsApi, Contest } from '@/lib/api';
import { isDailyContest, isDailyContestLive } from '@/lib/dailyContestUtils';
import { ContestCard } from '@/components/ContestCard';
import AdsenseAd from '@/components/AdsenseAd';
import './custom-contest.css';

interface AnswerResult {
  questionId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeTaken: number;
}

type QuizMode = 'quick' | 'standard' | 'timeless' | null; // quick: 5 questions/30s, standard: 10 questions/60s, timeless: 10 questions/no limit

export default function CustomContestPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizMode, setQuizMode] = useState<QuizMode>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [score, setScore] = useState(0);
  const [questionKey, setQuestionKey] = useState(0); // For triggering animations on question change
  const [isMuted, setIsMuted] = useState(false);
  const [contests, setContests] = useState<Contest[]>([]);
  const [contestsLoading, setContestsLoading] = useState(false);
    const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedCoins, setAnimatedCoins] = useState(0);
  const [animatedCorrect, setAnimatedCorrect] = useState(0);
  const [animatedWrong, setAnimatedWrong] = useState(0);
  const questionScrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Animate number counting
  const animateNumber = useCallback((start: number, end: number, duration: number, setter: (n: number) => void) => {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * easeOut);
      setter(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, []);

  // Fetch other contests for the "More Contests" section
  const fetchContests = useCallback(async () => {
    try {
      setContestsLoading(true);
      const response = await contestsApi.getList();
      const contests = response.data || [];

      // Filter for LIVE contests (daily in their time window, or regular between start and end)
      const now = new Date();
      const liveContests = contests.filter((contest: any) => {
        if (isDailyContest(contest)) {
          return isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
        }
        if (!contest.startDate || !contest.endDate) return false;
        const start = new Date(contest.startDate);
        const end = new Date(contest.endDate);
        return now >= start && now <= end;
      });

      // Take up to 5 live contests (or 0 if none available)
      setContests(liveContests.slice(0, 5));
    } catch (err) {
      console.error('Error fetching contests:', err);
    } finally {
      setContestsLoading(false);
    }
  }, []);

  useEffect(() => {
    const categoryNames = sessionStorage.getItem('customContestCategories');
    if (!categoryNames) {
      router.push('/dashboard');
      return;
    }
    setLoading(false);
  }, []);

  // Auto-scroll to current question indicator
  useEffect(() => {
    if (questionScrollRef.current && quizStarted) {
      const questionElement = questionScrollRef.current.children[0]?.children[currentQuestionIndex] as HTMLElement;
      if (questionElement) {
        questionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentQuestionIndex, quizStarted]);

  // Trigger animations and fetch contests when quiz completes
  useEffect(() => {
    if (quizCompleted) {
      const correctCount = answers.filter(a => a.isCorrect).length;
      const wrongCount = answers.filter(a => !a.isCorrect && a.selectedAnswer).length;
      const totalQuestions = questions.length;
      const coinsAwarded = Math.floor((correctCount / totalQuestions) * 200);

      // Animate numbers with staggered timing
      setTimeout(() => animateNumber(0, score, 800, setAnimatedScore), 200);
      setTimeout(() => animateNumber(0, coinsAwarded, 800, setAnimatedCoins), 400);
      setTimeout(() => animateNumber(0, correctCount, 600, setAnimatedCorrect), 600);
      setTimeout(() => animateNumber(0, wrongCount, 600, setAnimatedWrong), 800);

      // Fetch contests for "More Contests" section
      fetchContests();
    }
  }, [quizCompleted, answers, questions.length, score, animateNumber, fetchContests]);

  // Timer for entire contest (skip for timeless mode)
  useEffect(() => {
    if (quizStarted && timeRemaining > 0 && questions.length > 0 && quizMode !== 'timeless') {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Time's up - auto-submit all remaining questions
            handleContestTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quizStarted, timeRemaining, questions.length, quizMode]);

  const fetchQuestions = async (mode: QuizMode) => {
    try {
      setLoading(true);
      const categoryNames = JSON.parse(sessionStorage.getItem('customContestCategories') || '[]');
      
      const questionCount = mode === 'quick' ? 5 : 10;
      
      // Fetch questions by categories (using category names)
      let allQuestions: Question[] = [];
      const questionIds = new Set<string>();
      
      // Try to fetch questions for each category
      try {
        const data = await questionsApi.getByCategories(categoryNames, questionCount * 2); // Get more to ensure we have enough
        allQuestions = data;
      } catch (err) {
        // Fallback: fetch random questions multiple times to get enough unique questions
        console.log('Category-based API not available, fetching random questions...');
        
        // Fetch multiple batches to get enough questions
        for (let i = 0; i < 10; i++) {
          try {
            const batch = await questionsApi.getRandom(10);
            batch.forEach(q => {
              if (!questionIds.has(q.id)) {
                questionIds.add(q.id);
                allQuestions.push(q);
              }
            });
            if (allQuestions.length >= questionCount * 2) break;
          } catch (e) {
            console.error('Error fetching batch:', e);
          }
        }
        
        // Ensure we have unique questions
        allQuestions = Array.from(new Map(allQuestions.map(q => [q.id, q])).values());
      }
      
      // Transform and filter questions - ensure options are always strings
      const transformedQuestions = allQuestions.map((q: any) => {
        const stringOptions = q.options.map((opt: any) => {
          if (typeof opt === 'string') return opt;
          if (opt && typeof opt === 'object') {
            return opt.text || String(opt);
          }
          return String(opt || '');
        });
        
        let correctOptionStr = q.correctOption;
        if (typeof correctOptionStr !== 'string') {
          correctOptionStr = String(correctOptionStr || '');
        }
        
        // Shuffle options to randomize correct answer position
        // The correctOption is stored as the actual text value, so we just shuffle the array
        const shuffledOptions = [...stringOptions].sort(() => Math.random() - 0.5);
        
        return {
          ...q,
          options: shuffledOptions,
          correctOption: correctOptionStr, // Keep the same value, it will now be in a random position
        };
      });
      
      // Filter to only include questions with exactly 4 valid options
      const filteredQuestions = transformedQuestions.filter((q: any) => {
        if (!q.options || !Array.isArray(q.options)) return false;
        const validOptions = q.options.filter((opt: string) => {
          return opt && opt.trim().length > 0;
        });
        return validOptions.length === 4;
      });
      
      // Shuffle and select the required number of questions (mix from all categories)
      const shuffled = [...filteredQuestions].sort(() => Math.random() - 0.5);
      const finalQuestions = shuffled.slice(0, questionCount);
      
      if (finalQuestions.length === 0) {
        setError('No questions available. Please try again.');
      } else {
        setQuestions(finalQuestions);
        setQuizMode(mode);
        // Start quiz immediately after loading questions
        setQuizStarted(true);
        // Total time for entire contest: 30s for quick, 60s for standard, no limit for timeless
        if (mode === 'timeless') {
          setTimeRemaining(999999); // Set a very high number so timer doesn't run out
        } else {
          const totalTime = mode === 'quick' ? 30 : 60;
          setTimeRemaining(totalTime);
        }
        setQuestionStartTime(Date.now());
        
        // Start playing background music
        if (audioRef.current && !isMuted) {
          audioRef.current.play().catch(err => {
            console.error('Error playing music:', err);
          });
        }
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.play().catch(err => {
          console.error('Error playing music:', err);
        });
      } else {
        audioRef.current.pause();
      }
      setIsMuted(!isMuted);
    }
  };

  const handleContestTimeUp = () => {
    // Auto-submit all remaining unanswered questions
    const remainingQuestions = questions.slice(currentQuestionIndex);
    const newAnswers: AnswerResult[] = [...answers];
    
    remainingQuestions.forEach((question) => {
      const answerResult: AnswerResult = {
        questionId: question.id,
        selectedAnswer: '',
        correctAnswer: question.correctOption,
        isCorrect: false,
        timeTaken: 0,
      };
      newAnswers.push(answerResult);
    });
    
    setAnswers(newAnswers);
    setQuizCompleted(true);
    setQuizStarted(false);
    
    // Stop music when contest completes
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };


  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer || !quizStarted || (quizMode !== 'timeless' && timeRemaining <= 0) || !questions[currentQuestionIndex]) return;
    
    setSelectedAnswer(option);
    
    const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = option === currentQuestion.correctOption;
    
    const answerResult: AnswerResult = {
      questionId: currentQuestion.id,
      selectedAnswer: option,
      correctAnswer: currentQuestion.correctOption,
      isCorrect,
      timeTaken,
    };

    handleAnswerSubmission(answerResult);
  };

  const handleAnswerSubmission = (answerResult: AnswerResult) => {
    const newAnswers = [...answers, answerResult];
    setAnswers(newAnswers);

    // Update score
    if (answerResult.isCorrect) {
      setScore((prev) => prev + 25);
    } else if (answerResult.selectedAnswer) {
      setScore((prev) => Math.max(0, prev - 10));
    }

    // Move to next question or complete quiz
    if (currentQuestionIndex < questions.length - 1 && (quizMode === 'timeless' || timeRemaining > 0)) {
      setTimeout(() => {
        setQuestionKey(prev => prev + 1); // Trigger animation on question change
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
        // Don't reset timer - it's for the entire contest
        setQuestionStartTime(Date.now());
      }, 1500);
    } else {
      // Quiz completed
      setTimeout(() => {
        setQuizCompleted(true);
        setQuizStarted(false);
        // Stop music when quiz completes
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      }, 1500);
    }
  };

  if (loading && !quizMode) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] flex flex-col items-center justify-center px-4">
          <div className="relative mb-6">
            <div className="w-14 h-14 rounded-full border-4 border-[#FFF6D9]/20 border-t-[#FFD602] animate-loading-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <img src="/logo.svg" alt="" className="w-6 h-6 opacity-90" />
            </div>
          </div>
          <p className="text-[#FFF6D9] text-lg font-medium">Loading...</p>
          <p className="text-[#FFD602] text-sm mt-1 font-semibold animate-loading-dots">...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (error && !quizMode) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] flex items-center justify-center p-5">
          <div className="text-center">
            <div className="mb-6">
              <svg className="w-16 h-16 mx-auto text-[#FF6B6B] opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-[#FFF6D9] text-lg mb-2 font-semibold">Something went wrong</p>
            <p className="text-[#FFF6D9]/70 text-sm mb-6">{error}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-[#FFF6D9] text-[#0D0009] px-6 py-3 rounded-xl font-bold hover:bg-[#FFF6D9]/90 relative overflow-hidden"
              style={{
                boxShadow: '0px 0px 2px 0px #FFF6D9'
              }}
            >
              <span className="relative z-10">Go Back to Dashboard</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Show quiz mode selection
  if (!quizMode) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-fit bg-[#0D0009] p-5" style={{
          boxShadow: '0px 0px 2px 0px #FFF6D9'
        }}>
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-[#FFF6D9] text-3xl font-bold mb-2">Custom Contest</h1>
              <p className="text-[#FFF6D9]/70 text-sm">Choose your quiz mode</p>
            </div>

            {/* Quiz Mode Options */}
            <div className="space-y-4">
              {/* Quick Mode: 5 questions, 30 seconds */}
              <button
                onClick={() => fetchQuestions('quick')}
                disabled={loading}
                className="w-full bg-[#FFF6D9] rounded-xl p-6 text-left hover:bg-[#FFF6D9]/90 transition-all transform hover:scale-[1.02] relative overflow-hidden"
                style={{
                  boxShadow: '0px 0px 2px 0px #FFF6D9'
                }}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[#0D0009] text-xl font-bold">Quick Quiz</h3>
                    <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">FAST</span>
                  </div>
                  <div className="flex items-center gap-4 text-[#0D0009]/80 text-sm">
                    <div className="flex items-center gap-2">
                      <span>📝</span>
                      <span>5 Questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>⏱️</span>
                      <span>30 sec total</span>
                    </div>
                  </div>
                </div>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>

              {/* Standard Mode: 10 questions, 60 seconds */}
              <button
                onClick={() => fetchQuestions('standard')}
                disabled={loading}
                className="w-full bg-[#FFF6D9] rounded-xl p-6 text-left hover:bg-[#FFF6D9]/90 transition-all transform hover:scale-[1.02] relative overflow-hidden"
                style={{
                  boxShadow: '0px 0px 2px 0px #FFF6D9'
                }}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[#0D0009] text-xl font-bold">Standard Quiz</h3>
                    <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">CLASSIC</span>
                  </div>
                  <div className="flex items-center gap-4 text-[#0D0009]/80 text-sm">
                    <div className="flex items-center gap-2">
                      <span>📝</span>
                      <span>10 Questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>⏱️</span>
                      <span>60 sec total</span>
                    </div>
                  </div>
                </div>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>

              {/* Timeless Mode: 10 questions, no time limit */}
              <button
                onClick={() => fetchQuestions('timeless')}
                disabled={loading}
                className="w-full bg-[#FFF6D9] rounded-xl p-6 text-left hover:bg-[#FFF6D9]/90 transition-all transform hover:scale-[1.02] relative overflow-hidden"
                style={{
                  boxShadow: '0px 0px 2px 0px #FFF6D9'
                }}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[#0D0009] text-xl font-bold">Timeless Quiz</h3>
                    <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">RELAXED</span>
                  </div>
                  <div className="flex items-center gap-4 text-[#0D0009]/80 text-sm">
                    <div className="flex items-center gap-2">
                      <span>📝</span>
                      <span>10 Questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>♾️</span>
                      <span>No time limit</span>
                    </div>
                  </div>
                </div>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>

              
            </div>

            {loading && (
              <div className="text-center text-[#FFF6D9] mt-6">Loading questions...</div>
            )}
          </div>
        </div>
        <p className="text-center text-white w-full text-xs mt-2 mb-2 font-medium">ADVERTISEMENT</p>
              <div className="w-full overflow-hidden border-b border-[#564C53] ">
                <AdsenseAd adSlot="8153775072" adFormat="auto" />
              </div>
        <Footer />
      </>
    );
  }

  // Quiz completed screen
  if (quizCompleted) {
    const correctCount = answers.filter(a => a.isCorrect).length;
    const wrongCount = answers.filter(a => !a.isCorrect && a.selectedAnswer).length;
    const totalQuestions = questions.length;
    const coinsAwarded = Math.floor((correctCount / totalQuestions) * 200);

    return (
      <>
        <DashboardNav />
        {/* Background Music */}
        <audio
          ref={audioRef}
          loop
          preload="auto"
          style={{ display: 'none' }}
        >
          <source src="/background-music.mp3" type="audio/mpeg" />
          <source src="/background-music.ogg" type="audio/ogg" />
          Your browser does not support the audio element.
        </audio>

        <div className="min-h-fit bg-[#0D0009] px-5 pt-5 pb-0">
          <div className="max-w-md mx-auto">
            {/* Header with animated coins */}
            <div className="text-center mb-4 animate-slide-in-down">
              <p className="text-[#FFF6D9] text-sm mb-1">Custom Contest</p>
              <h1 className="text-[#FFF6D9] text-2xl font-bold mb-2">Results</h1>
              <div className="flex items-center justify-center gap-2">
                <img src="/coin2.svg" alt="Coins" className="w-6 h-6 animate-coin-spin" />
                <span className="text-[#FFD700] font-bold text-xl animate-glow-pulse" style={{ textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' }}>
                  {animatedCoins.toLocaleString()} COINS
                </span>
              </div>
            </div>

            {/* Results Card with enhanced animations */}
            <div className="bg-gradient-to-b from-[#FFF6D9] to-[#F5E6C8] rounded-2xl p-6 text-center mb-4 border border-[#BFBAA7] animate-result-card-slide relative overflow-hidden" style={{
              boxShadow: '0px 4px 20px rgba(255, 215, 0, 0.3), 0px 0px 2px 0px #FFF6D9'
            }}>
              {/* Shimmer overlay */}
              <div className="absolute inset-0 animate-shimmer pointer-events-none" />

              {/* Trophy with enhanced animation */}
              <div className="relative mb-4 flex justify-center items-center">
                {/* Sparkle effects around trophy */}
                <div className="absolute -top-2 -left-4 text-2xl animate-star-sparkle" style={{ animationDelay: '0s' }}>✨</div>
                <div className="absolute -top-2 -right-4 text-2xl animate-star-sparkle" style={{ animationDelay: '0.5s' }}>✨</div>
                <div className="absolute top-8 -left-8 text-xl animate-star-sparkle" style={{ animationDelay: '1s' }}>⭐</div>
                <div className="absolute top-8 -right-8 text-xl animate-star-sparkle" style={{ animationDelay: '1.5s' }}>⭐</div>

                <div className="flex justify-center animate-trophy-rotate-and-tilt">
                  <img src="/trophy.svg" alt="Trophy" className="w-28 h-28 drop-shadow-2xl" />
                </div>
              </div>

              {/* Messages with celebration effect */}
              <div className="animate-celebrate-pop" style={{ animationDelay: '0.3s' }}>
                <p className="text-[#0D0009] text-xl font-bold mb-1">
                  {correctCount === totalQuestions ? '🎉 Perfect Score! 🎉' :
                   correctCount >= totalQuestions * 0.8 ? '🌟 Excellent! 🌟' :
                   correctCount >= totalQuestions * 0.5 ? '👏 Well Played! 👏' :
                   '💪 Keep Practicing! 💪'}
                </p>
                <p className="text-[#0D0009]/80 text-sm mb-4">
                  You answered {correctCount} out of {totalQuestions} correctly!
                </p>
              </div>

              {/* Performance Metrics with staggered pop animation */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {/* Score */}
                <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0D0009] rounded-xl p-3 border border-[#FFD700]/30 flex flex-col items-center justify-center text-center animate-metric-pop metric-delay-1 transform hover:scale-105 transition-transform">
                  <p className="text-[#FFD700] text-2xl font-bold" style={{ textShadow: '0 0 8px rgba(255, 215, 0, 0.3)' }}>
                    {animatedScore}
                  </p>
                  <p className="text-[#FFF6D9]/70 text-[10px] mt-1 font-medium">Score</p>
                </div>
                {/* Questions */}
                <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0D0009] rounded-xl p-3 border border-[#4ECDC4]/30 flex flex-col items-center justify-center text-center animate-metric-pop metric-delay-2 transform hover:scale-105 transition-transform">
                  <p className="text-[#4ECDC4] text-2xl font-bold">
                    {totalQuestions}
                  </p>
                  <p className="text-[#FFF6D9]/70 text-[10px] mt-1 font-medium">Questions</p>
                </div>
                {/* Correct */}
                <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0D0009] rounded-xl p-3 border border-[#4CAF50]/30 flex flex-col items-center justify-center text-center animate-metric-pop metric-delay-3 transform hover:scale-105 transition-transform">
                  <p className="text-[#4CAF50] text-2xl font-bold">
                    {animatedCorrect}
                  </p>
                  <p className="text-[#FFF6D9]/70 text-[10px] mt-1 font-medium">Correct</p>
                </div>
                {/* Wrong */}
                <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0D0009] rounded-xl p-3 border border-[#FF6B6B]/30 flex flex-col items-center justify-center text-center animate-metric-pop metric-delay-4 transform hover:scale-105 transition-transform">
                  <p className="text-[#FF6B6B] text-2xl font-bold">
                    {animatedWrong}
                  </p>
                  <p className="text-[#FFF6D9]/70 text-[10px] mt-1 font-medium">Wrong</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    // Reset and go back to mode selection
                    setQuizMode(null);
                    setQuizStarted(false);
                    setQuizCompleted(false);
                    setCurrentQuestionIndex(0);
                    setSelectedAnswer(null);
                    setAnswers([]);
                    setScore(0);
                    setQuestions([]);
                    setAnimatedScore(0);
                    setAnimatedCoins(0);
                    setAnimatedCorrect(0);
                    setAnimatedWrong(0);
                    // Stop and reset music
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current.currentTime = 0;
                    }
                    setIsMuted(false);
                  }}
                  className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#0D0009] font-bold py-3 px-4 rounded-xl hover:from-yellow-500 hover:to-yellow-600 relative overflow-hidden transform hover:scale-[1.02] transition-all shadow-lg"
                  style={{ boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)' }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    PLAY AGAIN
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
                </button>

                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full bg-[#0D0009] text-[#FFF6D9] font-medium py-3 px-4 rounded-xl hover:bg-[#1a1a2e] border border-[#564C53] relative overflow-hidden transform hover:scale-[1.02] transition-all"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Back to Dashboard
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Advertisement - Full Width */}
        <div className="w-full overflow-hidden border-b border-[#564C53] mt-2">
          <p className="text-center text-white text-xs mt-1 mb-1 font-medium border-t border-[#564C53]">ADVERTISEMENT</p>
          <AdsenseAd adSlot="8153775072" adFormat="auto" />
        </div>

        {/* More Contests Section */}
        <div className="bg-[#0D0009] px-5 py-6">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#FFF6D9] text-lg font-bold flex items-center gap-2">
                <span>🎮</span> More Contests
              </h2>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-[#FFD700] text-sm font-medium hover:underline"
              >
                View All →
              </button>
            </div>

            {contestsLoading ? (
              <div className="text-center text-[#FFF6D9]/70 py-8">
                <div className="animate-loading-spin w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading contests...
              </div>
            ) : contests.length > 0 ? (
              <div className="space-y-4">
                {contests.map((contest, index) => (
                  <div
                    key={contest.id}
                    className="animate-slide-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <ContestCard
                      contest={contest}
                      playerCount={Math.floor(Math.random() * 500) + 100}
                      onPlayClick={() => router.push(`/contest/${contest.id}/rules`)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-[#FFF6D9]/70 py-8">
                <p>No contests available right now.</p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="mt-4 text-[#FFD700] font-medium hover:underline"
                >
                  Explore Dashboard →
                </button>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  return (
    <>
      <SEOHead 
        title="Custom Contest - Play Custom Quiz & Win 200 Coins | Quizwala"
        description="Play custom contests on Quizwala and win 200 coins! Test your knowledge with custom quiz questions and compete for exciting prizes."
        keywords="custom contest, custom quiz, play custom quiz, win coins, quiz contest"
      />
      <DashboardNav />
      {/* Background Music */}
      <audio
        ref={audioRef}
        loop
        preload="auto"
        style={{ display: 'none' }}
      >
        <source src="/background-music.mp3" type="audio/mpeg" />
        <source src="/background-music.ogg" type="audio/ogg" />
        Your browser does not support the audio element.
      </audio>
      
      <div className="min-h-fit bg-[#0D0009] p-5 pb-20" style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-4">
            <p className="text-[#FFF6D9] text-base mb-1">Custom Contest</p>
            <h1 className="text-[#FFF6D9] text-2xl font-bold mb-2">Play And Win</h1>
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/coin2.svg" alt="Coins" className="w-5 h-5" />
              <span className="text-[#FFF6D9] font-bold text-lg">200 COINS</span>
            </div>
          </div>
          
          {/* Mute/Unmute Button */}
          {quizStarted && (
            <div className="flex justify-end mb-2">
              <button
                onClick={toggleMute}
                className="bg-[#0D0009] hover:bg-[#0D0009]/80 rounded-full p-2 transition-colors border border-[#BFBAA7]"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg className="w-6 h-6 text-[#FFF6D9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-[#FFF6D9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* Quiz Started */}
          {quizStarted ? (
            <>
              {/* Question Card and Answer Options Container */}
              <div key={questionKey} className="bg-[#FFF6D9] rounded-xl p-4 mb-4 border border-[#BFBAA7]" style={{
                boxShadow: '0px 0px 2px 0px #FFF6D9'
              }}>
                {/* Timer - Only show for timed modes */}
                {quizMode !== 'timeless' && (
                  <div className="flex items-center justify-center mb-3">
                    <div className={`w-28 h-28 bg-white rounded-full border-4 ${timeRemaining <= 10 ? 'border-red-500' : 'border-blue-500'} flex flex-col items-center justify-center`}>
                      <span className="text-black text-4xl font-bold leading-tight">{timeRemaining}</span>
                      <span className="text-black text-sm">Seconds</span>
                    </div>
                  </div>
                )}
                <div className="text-center text-[#0D0009] mb-4 text-sm">
                  Question {currentQuestionIndex + 1}/{totalQuestions}
                </div>

                {/* Question Card */}
                <div className="bg-white rounded-lg p-6 mb-4 border border-[#BFBAA7] flex flex-col items-center">
                  <p className="text-[#0D0009] justify-center text-center font-bold text-base leading-relaxed mb-3 sm:mb-4">
                    {currentQuestion?.question}
                  </p>
                  {currentQuestion?.type === 'IMAGE' && currentQuestion?.media && (
                    (() => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                      let imageUrl = '';
                      
                      if (currentQuestion.media.startsWith('http://') || currentQuestion.media.startsWith('https://')) {
                        imageUrl = currentQuestion.media;
                      } else if (currentQuestion.media.includes('/')) {
                        imageUrl = `${baseUrl}/${currentQuestion.media}`;
                      } else {
                        imageUrl = `${baseUrl}/uploads/questions/contest/${currentQuestion.media}`;
                      }
                      
                      return (
                        <img
                          src={imageUrl}
                          alt="Question image"
                          className="max-w-full max-h-48 sm:max-h-64 md:max-h-80 rounded-xl object-contain"
                          onError={(e) => {
                            const img = e.currentTarget;
                            const mediaPath = currentQuestion.media;
                            const triedFallback = (img as any).dataset.triedFallback === 'true';
                            
                            if (!triedFallback && mediaPath && !mediaPath.includes('/')) {
                              (img as any).dataset.triedFallback = 'true';
                              if (img.src.includes('/uploads/questions/contest/')) {
                                img.src = `${baseUrl}/uploads/contests/${mediaPath}`;
                              } else {
                                img.style.display = 'none';
                              }
                            } else {
                              img.style.display = 'none';
                            }
                          }}
                        />
                      );
                    })()
                  )}
                  {currentQuestion?.type === 'VIDEO' && currentQuestion?.media && (
                    (() => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                      let videoUrl = '';
                      
                      if (currentQuestion.media.startsWith('http://') || currentQuestion.media.startsWith('https://')) {
                        videoUrl = currentQuestion.media;
                      } else if (currentQuestion.media.includes('/')) {
                        videoUrl = `${baseUrl}/${currentQuestion.media}`;
                      } else {
                        videoUrl = `${baseUrl}/uploads/questions/contest/${currentQuestion.media}`;
                      }
                      
                      return (
                        <video
                          src={videoUrl}
                          controls
                          className="max-w-full max-h-48 sm:max-h-64 md:max-h-80 rounded-xl object-contain"
                          onError={(e) => {
                            const video = e.currentTarget;
                            const mediaPath = currentQuestion.media;
                            const triedFallback = (video as any).dataset.triedFallback === 'true';
                            
                            if (!triedFallback && mediaPath && !mediaPath.includes('/')) {
                              (video as any).dataset.triedFallback = 'true';
                              if (video.src.includes('/uploads/questions/contest/')) {
                                video.src = `${baseUrl}/uploads/contests/${mediaPath}`;
                              } else {
                                video.style.display = 'none';
                              }
                            } else {
                              video.style.display = 'none';
                            }
                          }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      );
                    })()
                  )}
                  {currentQuestion?.type === 'AUDIO' && currentQuestion?.media && (
                    (() => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                      let audioUrl = '';
                      
                      if (currentQuestion.media.startsWith('http://') || currentQuestion.media.startsWith('https://')) {
                        audioUrl = currentQuestion.media;
                      } else if (currentQuestion.media.includes('/')) {
                        audioUrl = `${baseUrl}/${currentQuestion.media}`;
                      } else {
                        audioUrl = `${baseUrl}/uploads/questions/contest/${currentQuestion.media}`;
                      }
                      
                      return (
                        <audio
                          src={audioUrl}
                          controls
                          className="w-full max-w-md"
                          onError={(e) => {
                            const audio = e.currentTarget;
                            const mediaPath = currentQuestion.media;
                            const triedFallback = (audio as any).dataset.triedFallback === 'true';
                            
                            if (!triedFallback && mediaPath && !mediaPath.includes('/')) {
                              (audio as any).dataset.triedFallback = 'true';
                              if (audio.src.includes('/uploads/questions/contest/')) {
                                audio.src = `${baseUrl}/uploads/contests/${mediaPath}`;
                              } else {
                                audio.style.display = 'none';
                              }
                            } else {
                              audio.style.display = 'none';
                            }
                          }}
                        >
                          Your browser does not support the audio tag.
                        </audio>
                      );
                    })()
                  )}
                </div>

                {/* Answer Options */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  {currentQuestion?.options.map((option, index) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === currentQuestion.correctOption;
                    const showResult = selectedAnswer !== null;

                    let bgColor = 'bg-white';
                    let textColor = 'text-[#0D0009]';
                    let animationClass = '';

                    if (showResult) {
                      if (isCorrect) {
                        bgColor = 'bg-green-500';
                        textColor = 'text-white';
                      } else if (isSelected && !isCorrect) {
                        bgColor = 'bg-red-500';
                        textColor = 'text-white';
                        animationClass = 'animate-wrong-answer'; // Keep shake animation for wrong answers
                      } else {
                        bgColor = 'bg-white';
                        textColor = 'text-[#0D0009]';
                      }
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={selectedAnswer !== null || !quizStarted || (quizMode !== 'timeless' && timeRemaining <= 0)}
                        className={`${bgColor} ${textColor} ${animationClass} rounded-xl p-4 font-medium disabled:opacity-50 transition-all duration-300 border border-[#BFBAA7]`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          {quizStarted && (
            <>
              {/* Score */}
              <div className="text-center text-[#FFD700] font-bold mb-4">
                Your Score: {score}
              </div>

              {/* Question Progress Indicators */}
              <div className="relative mb-4">
                {/* Left Arrow Button */}
                <button
                  onClick={() => {
                    if (questionScrollRef.current) {
                      questionScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                    }
                  }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-[#0D0009] hover:bg-[#0D0009]/80 rounded-full p-2 shadow-lg transition-colors border border-[#BFBAA7]"
                  aria-label="Scroll left"
                >
                  <svg className="w-5 h-5 text-[#FFF6D9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Scrollable Question Indicators */}
                <div 
                  ref={questionScrollRef}
                  className="overflow-x-auto scroll-smooth hide-scrollbar"
                  style={{ 
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  <div className="flex flex-nowrap gap-2 justify-start min-w-max px-8">
                    {Array.from({ length: totalQuestions }, (_, index) => {
                      const answer = answers[index];
                      let bgColor = 'bg-gray-500';
                      if (index === currentQuestionIndex && !answer) {
                        bgColor = 'bg-yellow-500';
                      } else if (answer) {
                        bgColor = answer.isCorrect ? 'bg-green-500' : 'bg-red-500';
                      }

                      return (
                        <div
                          key={index}
                          className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-all duration-300`}
                        >
                          Q{index + 1}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Arrow Button */}
                <button
                  onClick={() => {
                    if (questionScrollRef.current) {
                      questionScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                    }
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-[#0D0009] hover:bg-[#0D0009]/80 rounded-full p-2 shadow-lg transition-colors border border-[#BFBAA7]"
                  aria-label="Scroll right"
                >
                  <svg className="w-5 h-5 text-[#FFF6D9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
