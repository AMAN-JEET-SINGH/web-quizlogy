'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { authApi, User, questionsApi } from '@/lib/api';

interface QuizQuestion {
  id: string;
  question: string;
  type: string;
  media: string | null;
  options: string[];
  correctOption: string;
}

interface AnswerResult {
  questionId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeTaken: number;
}

export default function CustomQuizPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(60); // 60 seconds per question
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [freezeTimeActive, setFreezeTimeActive] = useState(false);
  const questionScrollRef = useRef<HTMLDivElement>(null);

  const TOTAL_QUESTIONS = 20;
  const QUESTION_TIME = 60; // 60 seconds per question

  useEffect(() => {
    fetchQuestions();
    fetchUserData();
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

  // Timer for each question
  useEffect(() => {
    if (quizStarted && timeRemaining > 0 && !freezeTimeActive && questions.length > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Time's up - mark current question as unanswered and move to next
            const currentQ = questions[currentQuestionIndex];
            if (currentQ) {
              const answerResult: AnswerResult = {
                questionId: currentQ.id,
                selectedAnswer: '',
                correctAnswer: currentQ.correctOption,
                isCorrect: false,
                timeTaken: QUESTION_TIME,
              };
              setAnswers((prevAnswers) => [...prevAnswers, answerResult]);
              
              // Move to next question or complete quiz
              setTimeout(() => {
                if (currentQuestionIndex < questions.length - 1) {
                  setCurrentQuestionIndex(currentQuestionIndex + 1);
                  setTimeRemaining(QUESTION_TIME);
                  setQuestionStartTime(Date.now());
                  setFreezeTimeActive(false);
                } else {
                  setQuizCompleted(true);
                  setQuizStarted(false);
                }
              }, 1500);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quizStarted, timeRemaining, freezeTimeActive, questions, currentQuestionIndex]);

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
          console.error('Error fetching user:', err);
        }
      }
    } catch (err) {
      console.error('Error checking auth:', err);
    }
  };

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      
      // Fetch random questions - try to get 20 unique questions
      let allQuestions: any[] = [];
      const questionIds = new Set<string>();
      
      // Fetch multiple batches to get enough questions
      for (let i = 0; i < 10; i++) {
        try {
          const batch = await questionsApi.getRandom(10);
          batch.forEach((q: any) => {
            if (!questionIds.has(q.id)) {
              questionIds.add(q.id);
              allQuestions.push(q);
            }
          });
          if (allQuestions.length >= TOTAL_QUESTIONS) break;
        } catch (e) {
          console.error('Error fetching batch:', e);
        }
      }
      
      // Ensure we have unique questions and transform them
      const uniqueQuestions = Array.from(new Map(allQuestions.map(q => [q.id, q])).values()).slice(0, TOTAL_QUESTIONS);
      
      // Transform questions to match our format
      const transformedQuestions: QuizQuestion[] = uniqueQuestions.map((q: any) => {
        // Parse options if they're stored as JSON string
        let options: string[] = [];
        if (typeof q.options === 'string') {
          try {
            const parsed = JSON.parse(q.options);
            options = Array.isArray(parsed) ? parsed : [];
          } catch {
            options = [];
          }
        } else if (Array.isArray(q.options)) {
          options = q.options.map((opt: any) => {
            if (typeof opt === 'string') return opt;
            if (opt && typeof opt === 'object') return opt.text || String(opt);
            return String(opt || '');
          });
        }
        
        // Ensure we have exactly 4 options
        while (options.length < 4) {
          options.push('');
        }
        options = options.slice(0, 4);
        
        // Handle correctOption
        let correctOption = q.correctOption || '';
        if (typeof correctOption !== 'string') {
          correctOption = String(correctOption);
        }
        
        return {
          id: q.id,
          question: q.question || '',
          type: q.type || 'NONE',
          media: q.media || null,
          options: options.filter(opt => opt && opt.trim().length > 0),
          correctOption: correctOption.trim(),
        };
      }).filter(q => q.options.length >= 2 && q.correctOption); // Filter out invalid questions
      
      if (transformedQuestions.length === 0) {
        throw new Error('No valid questions available');
      }
      
      // Take exactly 20 questions (or as many as available)
      const finalQuestions = transformedQuestions.slice(0, TOTAL_QUESTIONS);
      setQuestions(finalQuestions);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = () => {
    // Check if user has enough coins (if needed)
    // For custom quiz, we can skip coin check or make it free
    setQuizStarted(true);
    setTimeRemaining(QUESTION_TIME);
    setQuestionStartTime(Date.now());
  };

  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer || !quizStarted || timeRemaining <= 0) return;
    
    setSelectedAnswer(option);
    setFreezeTimeActive(true);
    
    const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
    const currentQ = questions[currentQuestionIndex];
    const isCorrect = option === currentQ.correctOption;
    
    const answerResult: AnswerResult = {
      questionId: currentQ.id,
      selectedAnswer: option,
      correctAnswer: currentQ.correctOption,
      isCorrect,
      timeTaken,
    };

    handleAnswerSubmission(answerResult);
  };

  const handleAnswerSubmission = (answerResult: AnswerResult) => {
    const newAnswers = [...answers, answerResult];
    setAnswers(newAnswers);

    // Update score (simple scoring: +1 for correct, 0 for wrong)
    if (answerResult.isCorrect) {
      setScore((prev) => prev + 1);
    }

    // Move to next question or complete quiz
    if (currentQuestionIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
        setTimeRemaining(QUESTION_TIME);
        setQuestionStartTime(Date.now());
        setFreezeTimeActive(false);
      }, 1500);
    } else {
      // Quiz completed
      setTimeout(() => {
        setQuizCompleted(true);
        setQuizStarted(false);
      }, 1500);
    }
  };

  if (loading) {
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
          <p className="text-[#FFF6D9] text-lg font-medium">Loading questions...</p>
          <p className="text-[#FFD602] text-sm mt-1 font-semibold animate-loading-dots">...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (questions.length === 0) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] flex items-center justify-center p-5">
          <div className="text-center">
            <div className="mb-6">
              <svg className="w-16 h-16 mx-auto text-[#FFD602] opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[#FFF6D9] text-lg mb-2 font-semibold">No Questions Available</p>
            <p className="text-[#FFF6D9]/70 text-sm mb-6">Please try again later.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#0D0009] px-6 py-3 rounded-xl font-bold hover:from-yellow-500 hover:to-yellow-600 transition-all transform hover:scale-105 shadow-lg relative overflow-hidden"
              style={{ boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)' }}
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

  if (quizCompleted) {
    const correctCount = answers.filter(a => a.isCorrect).length;
    const wrongCount = answers.filter(a => !a.isCorrect && a.selectedAnswer !== null).length;

    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] p-5 pb-20">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <p className="text-white text-sm mb-1">Custom Quiz</p>
              <h1 className="text-white text-2xl font-bold mb-2">Play And Win</h1>
            </div>

            {/* Results Card */}
            <div className="bg-[#2C2159] rounded-xl p-8 text-center mb-4">
              {/* Trophy */}
              <div className="relative mb-6 flex justify-center items-start">
                <div className="flex justify-center">
                  <img src="/trophy.svg" alt="Trophy" className="w-24 h-24" />
                </div>
              </div>

              {/* Messages */}
              <p className="text-white text-lg mb-2">Quiz Completed! Well Played</p>
              <p className="text-white text-2xl font-bold mb-1">
                Your Score: <span className="text-yellow-400">{score}/{TOTAL_QUESTIONS}</span>
              </p>

              {/* Performance Metrics */}
              <div className="grid grid-cols-4 gap-3 mb-6 mt-6">
                <div className="border-[1px] border-white rounded-lg p-3">
                  <p className="text-white text-2xl font-bold">-</p>
                  <p className="text-white/80 text-xs mt-1">Rank</p>
                </div>
                <div className="rounded-lg p-3">
                  <p className="text-white text-2xl font-bold">{TOTAL_QUESTIONS}</p>
                  <p className="text-white/80 text-xs mt-1">Questions</p>
                </div>
                <div className="rounded-lg p-3">
                  <p className="text-white text-2xl font-bold">{correctCount}</p>
                  <p className="text-white/80 text-xs mt-1">Correct</p>
                </div>
                <div className="rounded-lg p-3">
                  <p className="text-white text-2xl font-bold">{wrongCount}</p>
                  <p className="text-white/80 text-xs mt-1">Wrong</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 bg-yellow-400 text-[#392C6E] font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 relative overflow-hidden"
                >
                  <span className="relative z-10">BACK TO DASHBOARD</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
                </button>
                <button
                  onClick={() => {
                    // Reset and restart quiz
                    setCurrentQuestionIndex(0);
                    setSelectedAnswer(null);
                    setAnswers([]);
                    setScore(0);
                    setQuizCompleted(false);
                    setQuizStarted(false);
                    setTimeRemaining(QUESTION_TIME);
                    fetchQuestions();
                  }}
                  className="flex-1 bg-white text-[#392C6E] font-bold py-3 px-4 rounded-lg hover:bg-gray-100"
                >
                  PLAY AGAIN
                </button>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  const timePercentage = (timeRemaining / QUESTION_TIME) * 100;

  return (
    <>
      <SEOHead 
        title="Custom Quiz - Play Personalized Quiz | Quizwala"
        description="Play custom quizzes tailored to your interests on Quizwala. Answer questions, test your knowledge, and earn rewards with personalized quiz content."
        keywords="custom quiz, personalized quiz, quiz game, custom questions, quiz test"
      />
      <DashboardNav />
      <div className="min-h-screen p-5 pb-20">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-4">
            <p className="text-white text-base mb-1">Custom Quiz</p>
            <h1 className="text-white text-2xl font-bold mb-2">Play And Win</h1>
          </div>

          {/* Timer */}
          {quizStarted ? (
            <>
              {/* Question Card and Answer Options Container */}
              <div className="bg-[#2C2159] rounded-xl p-4 mb-4">
                {/* Timer */}
                <div className="flex items-center justify-center mb-3">
                  <div className="w-28 h-28 bg-white rounded-full border-4 border-red-500 flex flex-col items-center justify-center">
                    <span className="text-black text-4xl font-bold leading-tight">{timeRemaining}</span>
                    <span className="text-black text-sm">Seconds</span>
                  </div>
                </div>
                <div className="text-center text-white mb-4 text-sm">
                  Question {currentQuestionIndex + 1}/{totalQuestions}
                </div>

                {/* Question Card */}
                <div className="bg-white rounded-lg p-6 mb-4">
                  <p className="text-[#392C6E] justify-center text-center font-bold text-base leading-relaxed">{currentQuestion.question}</p>
                </div>

                {/* Answer Options */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === currentQuestion.correctOption;
                    const showResult = selectedAnswer !== null;

                    let bgColor = 'bg-white';
                    let textColor = 'text-[#392C6E]';

                    if (showResult) {
                      // After answer is selected
                      if (isCorrect) {
                        bgColor = 'bg-green-500';
                        textColor = 'text-white';
                      } else if (isSelected && !isCorrect) {
                        bgColor = 'bg-red-500';
                        textColor = 'text-white';
                      } else {
                        bgColor = 'bg-white';
                        textColor = 'text-[#392C6E]';
                      }
                    } else {
                      // Default state
                      bgColor = 'bg-white';
                      textColor = 'text-[#392C6E]';
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={selectedAnswer !== null || !quizStarted || timeRemaining <= 0}
                        className={`${bgColor} ${textColor} rounded-xl p-4 font-medium disabled:opacity-50 transition-all duration-300 relative overflow-hidden flex items-center justify-center gap-2`}
                      >
                        <span className="flex-1 text-center">
                          {option}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center mb-4">
              <button
                onClick={startQuiz}
                className="bg-yellow-400 text-[#392C6E] font-bold py-3 px-8 rounded-lg hover:bg-yellow-500 relative overflow-hidden"
              >
                <span className="relative z-10">Start Quiz</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}

