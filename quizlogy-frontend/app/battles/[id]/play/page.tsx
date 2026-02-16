'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SEOHead } from '@/components/SEOHead';
import { battlesApi, Battle, authApi, User, getImageUrl as getBattleImageUrl } from '@/lib/api';
import './battle-play-game.css';
import AdsenseAd from '@/components/AdsenseAd';

interface BattleQuestion {
  id: string;
  question: string;
  type: string;
  media: string | null;
  options: string[];
  correctOption: string;
  order: number;
}

interface AnswerResult {
  questionId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeTaken: number;
  pointsDelta?: number;
  lifelinesUsed?: string[];
}

export default function BattlePlayGamePage() {
  const router = useRouter();
  const params = useParams();
  const battleId = params?.id as string;

  const [battle, setBattle] = useState<Battle | null>(null);
  const [questions, setQuestions] = useState<BattleQuestion[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [otherBattles, setOtherBattles] = useState<Battle[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<AnswerResult[]>([]);
  const [opponentAnswers, setOpponentAnswers] = useState<AnswerResult[]>([]);
  const [userScore, setUserScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(10);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [userProgress, setUserProgress] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [opponentName, setOpponentName] = useState('');
  const [usedLifelines, setUsedLifelines] = useState<Set<string>>(new Set());
  const [freezeTimeActive, setFreezeTimeActive] = useState(false);
  const [frozenTimeRemaining, setFrozenTimeRemaining] = useState<number | null>(null);
  const [freezeCountdown, setFreezeCountdown] = useState(30);
  const freezeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const freezeCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hasUsedLifelineThisQuestion, setHasUsedLifelineThisQuestion] = useState(false);
  const [activeFiftyFifty, setActiveFiftyFifty] = useState(false);
  const [removedOptions, setRemovedOptions] = useState<string[]>([]);
  const [activeAudiencePoll, setActiveAudiencePoll] = useState(false);
  const [audiencePollPercentages, setAudiencePollPercentages] = useState<{ [key: string]: number }>({});
  const [showingLifelineModal, setShowingLifelineModal] = useState<string | null>(null);
  const [showingLifelineSelection, setShowingLifelineSelection] = useState(false);
  const [showWinPopup, setShowWinPopup] = useState(false);
  const [allQuestionsPool, setAllQuestionsPool] = useState<BattleQuestion[]>([]);
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(new Set());
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [finalResults, setFinalResults] = useState<{
    userScore: number;
    opponentScore: number;
    totalQ: number;
    userCorrect: number;
    oppCorrect: number;
    userSpeed: number;
    oppSpeed: number;
    userLifelinesUsed: number;
    oppLifelinesUsed: number;
  } | null>(null);
  const questionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const hasAwardedCoins = useRef(false);
  const audiencePollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const botAnswerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lifelinesUsedThisQuestionRef = useRef<Set<string>>(new Set());
  const botPlanRef = useRef<{ questionId: string; timeTaken: number; willUseLifeline: boolean; isCorrect: boolean; selectedAnswer: string } | null>(null);
  const userAnswersRef = useRef<AnswerResult[]>([]);
  const opponentAnswersRef = useRef<AnswerResult[]>([]);
  const hasFinalizedRef = useRef(false);
  const battleMusicRef = useRef<HTMLAudioElement>(null);
  const correctSoundRef = useRef<HTMLAudioElement>(null);
  const wrongSoundRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(() => {
    try {
      // Keep same key as contest so user preference is consistent
      return localStorage.getItem('contestMusicMuted') === 'true';
    } catch {
      return false;
    }
  });
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  const QUESTION_TIME_LIMIT_SECONDS = 10;
  const SCORE_MIN = -100;
  const SCORE_MAX = 100;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const formatTimerPill = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    return `00:${String(s).padStart(2, '0')}s`;
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('contestMusicMuted', next.toString());
      } catch {}

      // Immediate play/pause on user gesture (same behavior as contest)
      const audio = battleMusicRef.current;
      if (audio) {
        if (next) {
          audio.pause();
          setIsMusicPlaying(false);
        } else {
          audio.volume = 0.8;
          audio.play().then(() => {
            setIsMusicPlaying(true);
          }).catch(() => {});
        }
      }
      return next;
    });
  };

  const playCorrectSfx = () => {
    if (isMuted) return;
    const audio = correctSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const playWrongSfx = () => {
    if (isMuted) return;
    const audio = wrongSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  // Background music control (same song as contest)
  useEffect(() => {
    const audio = battleMusicRef.current;
    if (!audio) return;

    const handlePlay = () => setIsMusicPlaying(true);
    const handlePause = () => setIsMusicPlaying(false);
    const handleEnded = () => setIsMusicPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    const audio = battleMusicRef.current;
    if (!audio) return;

    // Stop music on game end or when muted
    if (!gameStarted || gameCompleted || isMuted) {
      audio.pause();
      return;
    }

    // Try to play (may require user interaction; button will also trigger)
    audio.volume = 0.8;
    audio.play().catch(() => {});
  }, [gameStarted, gameCompleted, isMuted]);

  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  useEffect(() => {
    opponentAnswersRef.current = opponentAnswers;
  }, [opponentAnswers]);

  // Scoring (exactly per your table; clean numbers only)
  // ✅ Correct: +10
  // ✅ Correct + faster than opponent: +15
  // ❌ Wrong: -5
  // ⏱️ Timeout: -5
  // 🧠 Any lifeline used on that question: -5 (regardless of outcome)
  const computeBattleDelta = (opts: { isCorrect: boolean; isFaster: boolean; usedAnyLifeline: boolean; isTimeout?: boolean }) => {
    const base = opts.isCorrect ? 10 : -5;
    const speedBonus = opts.isCorrect && opts.isFaster ? 5 : 0;
    const lifelinePenalty = opts.usedAnyLifeline ? -5 : 0;
    return base + speedBonus + lifelinePenalty;
  };

  const hasOpponentAnswered = (questionId: string) =>
    opponentAnswersRef.current.some(a => a.questionId === questionId);

  const waitForOpponentOrForce = async (currentQ: BattleQuestion, maxWaitMs: number) => {
    if (hasFinalizedRef.current) return;
    const qid = currentQ.id;
    if (hasOpponentAnswered(qid)) return;

    setWaitingForOpponent(true);
    const start = Date.now();

    // Poll quickly to detect bot answer
    while (Date.now() - start < maxWaitMs) {
      if (hasOpponentAnswered(qid)) {
        setWaitingForOpponent(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    // Still no opponent answer -> force a timeout result (max wait 2s)
    setWaitingForOpponent(false);
    if (hasOpponentAnswered(qid)) return;

    if (botAnswerTimeoutRef.current) {
      clearTimeout(botAnswerTimeoutRef.current);
      botAnswerTimeoutRef.current = null;
    }

    const botPlan = botPlanRef.current;
    const botUsedAnyLifeline = !!(botPlan && botPlan.questionId === qid && botPlan.willUseLifeline);
    const delta = computeBattleDelta({
      isCorrect: false,
      isFaster: false,
      usedAnyLifeline: botUsedAnyLifeline,
      isTimeout: true,
    });

    const forced: AnswerResult = {
      questionId: qid,
      selectedAnswer: '',
      correctAnswer: currentQ.correctOption,
      isCorrect: false,
      timeTaken: QUESTION_TIME_LIMIT_SECONDS,
      pointsDelta: delta,
      lifelinesUsed: botUsedAnyLifeline ? ['bot-lifeline'] : [],
    };

    setOpponentAnswers((prev) => {
      if (prev.some(a => a.questionId === qid)) return prev;
      return [...prev, forced];
    });
    setOpponentScore((prevScore) => clamp(prevScore + delta, SCORE_MIN, SCORE_MAX));
  };

  useEffect(() => {
    fetchBattleData();
    fetchUserData();
    // Get opponent name from localStorage if available
    const storedOpponentName = localStorage.getItem('battleOpponentName');
    if (storedOpponentName) {
      setOpponentName(storedOpponentName);
    }
  }, [battleId]);

  useEffect(() => {
    if (battleId) {
      fetchOtherBattles();
    }
  }, [battleId]);

  // Auto-close win popup after 5 seconds
  useEffect(() => {
    if (showWinPopup) {
      const timer = setTimeout(() => {
        setShowWinPopup(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showWinPopup]);

  const fetchBattleData = async () => {
    try {
      setLoading(true);
      const data = await battlesApi.getById(battleId);
      const battleData = (data as any).data || data;
      setBattle(battleData);

      // Get questions for this battle
      const questionsData = await battlesApi.getQuestions(battleId);
      const questionsList = (questionsData as any).data || questionsData;

      // Parse options from JSON string to array
      const parsedQuestions = questionsList.map((q: any) => {
        let options = q.options;
        if (typeof options === 'string') {
          try {
            options = JSON.parse(options);
          } catch (e) {
            console.error('Error parsing options:', e);
            options = [];
          }
        }
        // Ensure options is an array
        if (!Array.isArray(options)) {
          options = [];
        }
        return {
          ...q,
          options,
        };
      });

      // Store all questions for flip feature
      setAllQuestionsPool(parsedQuestions);

      // Select 5 random questions
      const shuffled = [...parsedQuestions].sort(() => Math.random() - 0.5);
      const selectedQuestions = shuffled.slice(0, Math.min(5, parsedQuestions.length));
      setQuestions(selectedQuestions);
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

  const fetchOtherBattles = async () => {
    try {
      const allBattles = await battlesApi.getAll('ACTIVE');
      // Filter out the current battle
      const filtered = allBattles.filter((b: Battle) => b.id !== battleId);
      setOtherBattles(filtered);
    } catch (err) {
      console.error('Error fetching other battles:', err);
    }
  };

  // Start game immediately
  useEffect(() => {
    if (!loading && battle && questions.length > 0 && !gameStarted) {
        setGameStarted(true);
        startQuestion();
    }
  }, [loading, battle, questions.length, gameStarted]);

  // Question timer
  useEffect(() => {
    if (
      gameStarted &&
      questionTimeRemaining > 0 &&
      !gameCompleted &&
      !freezeTimeActive &&
      selectedAnswer === null &&
      !waitingForOpponent
    ) {
      questionTimerRef.current = setInterval(() => {
        setQuestionTimeRemaining((prev) => {
          if (prev <= 1) {
            handleQuestionTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (questionTimerRef.current) {
          clearInterval(questionTimerRef.current);
        }
      };
    }
  }, [gameStarted, questionTimeRemaining, gameCompleted, freezeTimeActive, selectedAnswer, waitingForOpponent]);

  // Battle meter (progress bar) based on score difference
  useEffect(() => {
    if (!gameStarted) return;
    // 50% = tie, shift by score difference. (range approx -100..100 => 0..100)
    const boundary = clamp(50 + (userScore - opponentScore) * 0.5, 0, 100);
    setUserProgress(boundary);
    setOpponentProgress(100 - boundary);
  }, [gameStarted, userScore, opponentScore]);

  const startQuestion = () => {
    setQuestionTimeRemaining(QUESTION_TIME_LIMIT_SECONDS);
    setSelectedAnswer(null);
      // Reset lifelines for new question
    setActiveFiftyFifty(false);
    setRemovedOptions([]);
    setActiveAudiencePoll(false);
    setAudiencePollPercentages({});
    lifelinesUsedThisQuestionRef.current = new Set();
    setHasUsedLifelineThisQuestion(false);
    setFreezeTimeActive(false);
    setFrozenTimeRemaining(null);
    setFreezeCountdown(30);
    if (freezeTimeoutRef.current) {
      clearTimeout(freezeTimeoutRef.current);
      freezeTimeoutRef.current = null;
    }
    if (freezeCountdownIntervalRef.current) {
      clearInterval(freezeCountdownIntervalRef.current);
      freezeCountdownIntervalRef.current = null;
    }
    if (audiencePollIntervalRef.current) {
      clearInterval(audiencePollIntervalRef.current);
    }
    
    // Only clear bot timeout if it's for a different question (not the current one)
    if (currentQuestionIndex < questions.length) {
      const currentQ = questions[currentQuestionIndex];
      const existingPlan = botPlanRef.current;
      // Only clear if the timeout is for a different question
      if (botAnswerTimeoutRef.current && existingPlan && existingPlan.questionId !== currentQ.id) {
        clearTimeout(botAnswerTimeoutRef.current);
        botAnswerTimeoutRef.current = null;
      }
    } else {
      // If we're past all questions, clear any pending timeout
      if (botAnswerTimeoutRef.current) {
        clearTimeout(botAnswerTimeoutRef.current);
        botAnswerTimeoutRef.current = null;
      }
    }
    
    botPlanRef.current = null;

    // Opponent makes a decision (acts like a real player: random delay 1-10s, correctness varies)
    if (currentQuestionIndex < questions.length) {
      const currentQ = questions[currentQuestionIndex];
      // If user is ahead, bot gets slightly stronger; if bot is ahead, slightly weaker
      const diff = userScore - opponentScore;
      const baseProb = 0.65;
      const probBoost = diff > 10 ? 0.08 : diff < -10 ? -0.05 : 0;
      const willUseLifeline = Math.random() < 0.12; // bot sometimes uses a lifeline (penalty)
      const lifelineBoost = willUseLifeline ? 0.12 : 0;
      const isOpponentCorrect = Math.random() < clamp(baseProb + probBoost + lifelineBoost, 0.45, 0.85);

      let opponentAnswer: string;
      if (isOpponentCorrect) {
        opponentAnswer = currentQ.correctOption;
      } else {
        // Pick a random wrong answer
        const wrongOptions = currentQ.options.filter(opt => opt !== currentQ.correctOption);
        opponentAnswer = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
      }

      const botTimeTaken = Math.floor(Math.random() * 10) + 1; // 1-10 seconds
      botPlanRef.current = {
        questionId: currentQ.id,
        timeTaken: botTimeTaken,
        willUseLifeline,
        isCorrect: isOpponentCorrect,
        selectedAnswer: opponentAnswer,
      };
      const opponentResultBase: AnswerResult = {
        questionId: currentQ.id,
        selectedAnswer: opponentAnswer,
        correctAnswer: currentQ.correctOption,
        isCorrect: isOpponentCorrect,
        timeTaken: botTimeTaken,
      };

      // Add opponent answer after a random delay (1-10 seconds, capped so it lands before question ends)
      const delayMs = Math.min(botTimeTaken * 1000, (QUESTION_TIME_LIMIT_SECONDS - 0.5) * 1000);
      const expectedQuestionId = currentQ.id;

      botAnswerTimeoutRef.current = setTimeout(() => {
        if (hasFinalizedRef.current || gameCompleted) return;
        // If already answered (forced or otherwise), don't change results later
        if (opponentAnswersRef.current.some(a => a.questionId === expectedQuestionId)) return;

        setOpponentAnswers((prev) => {
          if (prev.some(a => a.questionId === expectedQuestionId)) return prev;
          const updated = [...prev, opponentResultBase];
          const userAnswerForQ = userAnswersRef.current.find(a => a.questionId === expectedQuestionId);
          const userTimeTaken = userAnswerForQ?.timeTaken ?? QUESTION_TIME_LIMIT_SECONDS;
          const isFaster = opponentResultBase.isCorrect && opponentResultBase.timeTaken < userTimeTaken;
          const delta = computeBattleDelta({
            isCorrect: opponentResultBase.isCorrect,
            isFaster,
            usedAnyLifeline: willUseLifeline,
          });
          const opponentResult: AnswerResult = {
            ...opponentResultBase,
            pointsDelta: delta,
            lifelinesUsed: willUseLifeline ? ['bot-lifeline'] : [],
          };
          // Replace last entry with enriched result
          updated[updated.length - 1] = opponentResult;

          setOpponentScore((prevScore) => clamp(prevScore + delta, SCORE_MIN, SCORE_MAX));
          return updated;
        });
      }, delayMs);
    }
  };

  const handleQuestionTimeout = () => {
    if (currentQuestionIndex < questions.length) {
      const currentQ = questions[currentQuestionIndex];
      if (hasFinalizedRef.current) return;

      // User didn't answer - 0 points
      const lifelinesUsed = Array.from(lifelinesUsedThisQuestionRef.current);
      const userResultBase: AnswerResult = {
        questionId: currentQ.id,
        selectedAnswer: '',
        correctAnswer: currentQ.correctOption,
        isCorrect: false,
        timeTaken: QUESTION_TIME_LIMIT_SECONDS,
      };
      // Timeout counts as wrong answer sound
      playWrongSfx();
      setUserAnswers((prev) => {
        const updated = [...prev, userResultBase];
        const usedAnyLifeline = lifelinesUsed.length > 0;
        const delta = computeBattleDelta({
          isCorrect: false,
          isFaster: false,
          usedAnyLifeline,
          isTimeout: true,
        });
        const userResult: AnswerResult = { ...userResultBase, pointsDelta: delta, lifelinesUsed };
        updated[updated.length - 1] = userResult;
        setUserScore((prevScore) => clamp(prevScore + delta, SCORE_MIN, SCORE_MAX));
        return updated;
      });

      // Only wait for opponent at the very end (so final result never changes).
      (async () => {
      // Process bot's answer for current question if it hasn't been processed yet
      const botPlan = botPlanRef.current;
      if (botPlan && botPlan.questionId === currentQ.id) {
        // Check if bot has already answered
        if (!opponentAnswersRef.current.some(a => a.questionId === currentQ.id)) {
          // Bot hasn't answered yet, process it now based on the plan
          const opponentResultBase: AnswerResult = {
            questionId: currentQ.id,
            selectedAnswer: botPlan.selectedAnswer,
            correctAnswer: currentQ.correctOption,
            isCorrect: botPlan.isCorrect,
            timeTaken: botPlan.timeTaken,
          };
          
          const userAnswerForQ = userAnswersRef.current.find(a => a.questionId === currentQ.id);
          const userTimeTaken = userAnswerForQ?.timeTaken ?? QUESTION_TIME_LIMIT_SECONDS;
          const isFaster = opponentResultBase.isCorrect && opponentResultBase.timeTaken < userTimeTaken;
          const delta = computeBattleDelta({
            isCorrect: opponentResultBase.isCorrect,
            isFaster,
            usedAnyLifeline: botPlan.willUseLifeline,
          });
          const opponentResult: AnswerResult = {
            ...opponentResultBase,
            pointsDelta: delta,
            lifelinesUsed: botPlan.willUseLifeline ? ['bot-lifeline'] : [],
          };
          
          setOpponentAnswers((prev) => {
            if (prev.some(a => a.questionId === currentQ.id)) return prev;
            return [...prev, opponentResult];
          });
          setOpponentScore((prevScore) => clamp(prevScore + delta, SCORE_MIN, SCORE_MAX));
        }
        
        // Clear the bot timeout since we've processed the answer
        if (botAnswerTimeoutRef.current) {
          clearTimeout(botAnswerTimeoutRef.current);
          botAnswerTimeoutRef.current = null;
        }
      }
      
      if (currentQuestionIndex < questions.length - 1) {
        setTimeout(() => {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
          startQuestion();
        }, 1000);
          return;
        }

        await waitForOpponentOrForce(currentQ, 2000);
        if (hasFinalizedRef.current) return;

        {
          // Finalize immediately after opponent resolve
          hasFinalizedRef.current = true;
          if (questionTimerRef.current) clearInterval(questionTimerRef.current);
          if (botAnswerTimeoutRef.current) clearTimeout(botAnswerTimeoutRef.current);

          const finalUser = userAnswersRef.current.reduce((s, a) => s + (a.pointsDelta ?? 0), 0);
          const finalOpp = opponentAnswersRef.current.reduce((s, a) => s + (a.pointsDelta ?? 0), 0);
          const finalUserScore = clamp(finalUser, SCORE_MIN, SCORE_MAX);
          const finalOpponentScore = clamp(finalOpp, SCORE_MIN, SCORE_MAX);
          setUserScore(finalUserScore);
          setOpponentScore(finalOpponentScore);

          const totalQ = questions.length;
          const userCorrect = userAnswersRef.current.filter(a => a.isCorrect).length;
          const oppCorrect = opponentAnswersRef.current.filter(a => a.isCorrect).length;
          const userSpeed = userAnswersRef.current.reduce((sum, a) => sum + Math.max(0, QUESTION_TIME_LIMIT_SECONDS - a.timeTaken), 0);
          const oppSpeed = opponentAnswersRef.current.reduce((sum, a) => sum + Math.max(0, QUESTION_TIME_LIMIT_SECONDS - a.timeTaken), 0);
          const userLifelinesUsed = Math.min(4, usedLifelines.size);
          const oppLifelinesUsed = Math.min(4, new Set(opponentAnswersRef.current.flatMap(a => a.lifelinesUsed || [])).size);

          setFinalResults({
            userScore: finalUserScore,
            opponentScore: finalOpponentScore,
            totalQ,
            userCorrect,
            oppCorrect,
            userSpeed,
            oppSpeed,
            userLifelinesUsed,
            oppLifelinesUsed,
          });
          setGameCompleted(true);
          checkWinner(finalUserScore, finalOpponentScore);
      }
      })();
    }
  };

  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer || !gameStarted || questionTimeRemaining <= 0) return;
    if (hasFinalizedRef.current) return;

    // Clear audience poll when answer is selected
    setActiveAudiencePoll(false);
    setAudiencePollPercentages({});
    if (audiencePollIntervalRef.current) {
      clearInterval(audiencePollIntervalRef.current);
    }

    setSelectedAnswer(option);
    const timeTaken = QUESTION_TIME_LIMIT_SECONDS - questionTimeRemaining;
    const currentQ = questions[currentQuestionIndex];
    const isCorrect = option === currentQ.correctOption;
    const lifelinesUsed = Array.from(lifelinesUsedThisQuestionRef.current);

    // Play same sounds as contest
    if (isCorrect) playCorrectSfx();
    else playWrongSfx();

    const userResultBase: AnswerResult = {
      questionId: currentQ.id,
      selectedAnswer: option,
      correctAnswer: currentQ.correctOption,
      isCorrect,
      timeTaken,
    };

    setUserAnswers((prev) => {
      const updated = [...prev, userResultBase];
      const usedAnyLifeline = lifelinesUsed.length > 0;
      const botPlan = botPlanRef.current;
      const botTime = botPlan && botPlan.questionId === currentQ.id ? botPlan.timeTaken : QUESTION_TIME_LIMIT_SECONDS;
      const isFaster = isCorrect && timeTaken < botTime;
      const delta = computeBattleDelta({
        isCorrect,
        isFaster,
        usedAnyLifeline,
      });
      const userResult: AnswerResult = { ...userResultBase, pointsDelta: delta, lifelinesUsed };
      updated[updated.length - 1] = userResult;
      setUserScore((prevScore) => clamp(prevScore + delta, SCORE_MIN, SCORE_MAX));
      return updated;
    });

    // Only wait for opponent at the very end (so final result never changes).
    (async () => {
      // Let UI show correct/wrong highlight briefly
      await new Promise((r) => setTimeout(r, 600));
      
      // Process bot's answer for current question if it hasn't been processed yet
      const botPlan = botPlanRef.current;
      if (botPlan && botPlan.questionId === currentQ.id) {
        // Check if bot has already answered
        if (!opponentAnswersRef.current.some(a => a.questionId === currentQ.id)) {
          // Bot hasn't answered yet, process it now based on the plan
          const opponentResultBase: AnswerResult = {
            questionId: currentQ.id,
            selectedAnswer: botPlan.selectedAnswer,
            correctAnswer: currentQ.correctOption,
            isCorrect: botPlan.isCorrect,
            timeTaken: botPlan.timeTaken,
          };
          
          const userAnswerForQ = userAnswersRef.current.find(a => a.questionId === currentQ.id);
          const userTimeTaken = userAnswerForQ?.timeTaken ?? QUESTION_TIME_LIMIT_SECONDS;
          const isFaster = opponentResultBase.isCorrect && opponentResultBase.timeTaken < userTimeTaken;
          const delta = computeBattleDelta({
            isCorrect: opponentResultBase.isCorrect,
            isFaster,
            usedAnyLifeline: botPlan.willUseLifeline,
          });
          const opponentResult: AnswerResult = {
            ...opponentResultBase,
            pointsDelta: delta,
            lifelinesUsed: botPlan.willUseLifeline ? ['bot-lifeline'] : [],
          };
          
          setOpponentAnswers((prev) => {
            if (prev.some(a => a.questionId === currentQ.id)) return prev;
            return [...prev, opponentResult];
          });
          setOpponentScore((prevScore) => clamp(prevScore + delta, SCORE_MIN, SCORE_MAX));
        }
        
        // Clear the bot timeout since we've processed the answer
        if (botAnswerTimeoutRef.current) {
          clearTimeout(botAnswerTimeoutRef.current);
          botAnswerTimeoutRef.current = null;
        }
      }
      
    if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        startQuestion();
    } else {
        await waitForOpponentOrForce(currentQ, 2000);
        if (hasFinalizedRef.current) return;

        hasFinalizedRef.current = true;
        if (questionTimerRef.current) clearInterval(questionTimerRef.current);
        if (botAnswerTimeoutRef.current) clearTimeout(botAnswerTimeoutRef.current);

        const finalUser = userAnswersRef.current.reduce((s, a) => s + (a.pointsDelta ?? 0), 0);
        const finalOpp = opponentAnswersRef.current.reduce((s, a) => s + (a.pointsDelta ?? 0), 0);
        const finalUserScore = clamp(finalUser, SCORE_MIN, SCORE_MAX);
        const finalOpponentScore = clamp(finalOpp, SCORE_MIN, SCORE_MAX);
        setUserScore(finalUserScore);
        setOpponentScore(finalOpponentScore);

        const totalQ = questions.length;
        const userCorrect = userAnswersRef.current.filter(a => a.isCorrect).length;
        const oppCorrect = opponentAnswersRef.current.filter(a => a.isCorrect).length;
        const userSpeed = userAnswersRef.current.reduce((sum, a) => sum + Math.max(0, QUESTION_TIME_LIMIT_SECONDS - a.timeTaken), 0);
        const oppSpeed = opponentAnswersRef.current.reduce((sum, a) => sum + Math.max(0, QUESTION_TIME_LIMIT_SECONDS - a.timeTaken), 0);
        const userLifelinesUsed = Math.min(4, usedLifelines.size);
        const oppLifelinesUsed = Math.min(4, new Set(opponentAnswersRef.current.flatMap(a => a.lifelinesUsed || [])).size);

        setFinalResults({
          userScore: finalUserScore,
          opponentScore: finalOpponentScore,
          totalQ,
          userCorrect,
          oppCorrect,
          userSpeed,
          oppSpeed,
          userLifelinesUsed,
          oppLifelinesUsed,
        });
        setGameCompleted(true);
        checkWinner(finalUserScore, finalOpponentScore);
      }
    })();
  };

  const handleLifeline = async (lifelineType: string) => {
    // Check if a lifeline has already been used for this question
    if (lifelinesUsedThisQuestionRef.current.size > 0) {
      alert('You can only use one lifeline per question');
      return;
    }
    
    if (usedLifelines.has(lifelineType)) {
      alert('This lifeline has already been used');
      return;
    }

    if (!battle || !battleId) return;

    const lifelineCost = (battle as any).lifeLineCharge || 0;
    const storedUser = localStorage.getItem('user');
    const isGuest = !storedUser;
    
    // Get coins based on user type
    const userCoins = isGuest 
      ? parseInt(localStorage.getItem('guestCoins') || '0')
      : (user?.coins || 0);

    if (userCoins < lifelineCost) {
      // Show watch video option
      setShowingLifelineModal(lifelineType);
      return;
    }

    // Deduct coins and create history
    if (isGuest) {
      // Guest user - deduct from localStorage
      const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
      if (currentGuestCoins < lifelineCost) {
        setShowingLifelineModal(lifelineType);
        return;
      }
      const newGuestCoins = Math.max(0, currentGuestCoins - lifelineCost);
      localStorage.setItem('guestCoins', newGuestCoins.toString());
      // Trigger coins update event for navbar
      window.dispatchEvent(new Event('coinsUpdated'));
    } else {
      // Logged in user - call backend API to deduct coins and create history
      try {
        const response = await battlesApi.useLifeline(battleId, lifelineType);
        
        // Update user data with new coin balance from backend
        if (response.coins !== undefined) {
          if (user) {
            const updatedUser = { ...user, coins: response.coins };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            // Trigger coins update event for navbar
            window.dispatchEvent(new Event('coinsUpdated'));
          }
        }
      } catch (err: any) {
        if (err.response?.status === 400 && err.response?.data?.error === 'Insufficient coins') {
          setShowingLifelineModal(lifelineType);
          return;
        }
        alert(err.response?.data?.error || 'Failed to use lifeline. Please try again.');
        return;
      }
    }
    
    // Activate lifeline
    activateLifeline(lifelineType);
  };

  const handleWatchVideoForLifeline = async () => {
    if (!battle || !showingLifelineModal || !battleId) return;
    
    // TODO: Implement video watching logic
    alert('Video watching feature coming soon!');
    
    const storedUser = localStorage.getItem('user');
    const isGuest = !storedUser;
    const lifelineCost = (battle as any).lifeLineCharge || 0;
    
    // After watching video, award coins and use lifeline
    if (isGuest) {
      // Guest user - add to localStorage
      const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
      const newGuestCoins = currentGuestCoins + lifelineCost;
      localStorage.setItem('guestCoins', newGuestCoins.toString());
      // Trigger coins update event for navbar
      window.dispatchEvent(new Event('coinsUpdated'));
    } else {
      // Logged in user - award coins via backend API (creates coin history)
      try {
        await authApi.awardCoins(lifelineCost, 'Earned coins from watching video ad for lifeline', battleId);
        // Fetch updated user data
        const userData = await authApi.getCurrentUser();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        // Trigger coins update event for navbar
        window.dispatchEvent(new Event('coinsUpdated'));
      } catch (err) {
        // Fallback to local update if API fails
        if (user) {
          const updatedUser = { ...user, coins: (user.coins || 0) + lifelineCost };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
    }
    
    // Now use the lifeline without deducting coins (since we just added coins)
    activateLifeline(showingLifelineModal);
    setShowingLifelineModal(null);
  };

  const activateLifeline = (lifelineType: string) => {
    setUsedLifelines((prev) => new Set(prev).add(lifelineType));
    lifelinesUsedThisQuestionRef.current = new Set(lifelinesUsedThisQuestionRef.current).add(lifelineType);
    setHasUsedLifelineThisQuestion(true);
    
    const currentQ = questions[currentQuestionIndex];
    
    if (lifelineType === 'freeze') {
      // Store the current time remaining using a function to get the current state value
      setQuestionTimeRemaining((currentTime) => {
        setFrozenTimeRemaining(currentTime);
        setFreezeTimeActive(true);
        setFreezeCountdown(30);
        
        // Clear any existing freeze timeout and countdown
        if (freezeTimeoutRef.current) {
          clearTimeout(freezeTimeoutRef.current);
        }
        if (freezeCountdownIntervalRef.current) {
          clearInterval(freezeCountdownIntervalRef.current);
        }
        
        // Countdown for freeze (30 seconds)
        freezeCountdownIntervalRef.current = setInterval(() => {
          setFreezeCountdown((prev) => {
            if (prev <= 1) {
              if (freezeCountdownIntervalRef.current) {
                clearInterval(freezeCountdownIntervalRef.current);
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        // After 30 seconds, restore the timer
        freezeTimeoutRef.current = setTimeout(() => {
          setFreezeTimeActive(false);
          // Restore the timer to where it was when frozen
          setQuestionTimeRemaining(currentTime);
          setFrozenTimeRemaining(null);
          setFreezeCountdown(30);
          if (freezeCountdownIntervalRef.current) {
            clearInterval(freezeCountdownIntervalRef.current);
          }
        }, 30000); // Freeze for 30 seconds
        
        return currentTime; // Don't change the timer value, just store it
      });
    } else if (lifelineType === 'fifty-fifty') {
      // Remove two wrong options
      const wrongOptions = currentQ.options.filter(
        opt => opt !== currentQ.correctOption
      );
      const toRemove = wrongOptions.slice(0, 2);
      setRemovedOptions(toRemove);
      setActiveFiftyFifty(true);
    } else if (lifelineType === 'audience') {
      // Show audience poll - stays visible until answer is submitted
      setActiveAudiencePoll(true);
      
      // Initialize audience poll percentages
      const percentages: { [key: string]: number } = {};
      currentQ.options.forEach((option) => {
        if (option === currentQ.correctOption) {
          // Correct answer starts at 45%
          percentages[option] = 45;
        } else {
          // Wrong answers start at 15%
          percentages[option] = 15;
        }
      });
      setAudiencePollPercentages(percentages);

      // Continuously fluctuate the percentages
      if (audiencePollIntervalRef.current) {
        clearInterval(audiencePollIntervalRef.current);
      }
      audiencePollIntervalRef.current = setInterval(() => {
        setAudiencePollPercentages((prev) => {
          const newPercentages: { [key: string]: number } = {};
          currentQ.options.forEach((option) => {
            if (option === currentQ.correctOption) {
              // Correct answer fluctuates between 40-60%
              newPercentages[option] = 40 + Math.random() * 20;
            } else {
              // Wrong answers fluctuate between 5-25%
              newPercentages[option] = 5 + Math.random() * 20;
            }
          });
          return newPercentages;
        });
      }, 500);
    } else if (lifelineType === 'flip') {
      // Flip question: replace current question with a different one from the pool
      if (allQuestionsPool.length === 0) {
        alert('No alternative questions available');
        return;
      }
      
      const currentQuestionId = currentQ.id;
      
      // Get all question IDs currently in the quiz (excluding the current one we're replacing)
      const otherQuestionIds = new Set(
        questions
          .map((q, idx) => idx !== currentQuestionIndex ? q.id : null)
          .filter(id => id !== null) as string[]
      );
      
      // Find available questions that:
      // 1. Are not the current question
      // 2. Are not already in the quiz (other positions)
      // 3. Haven't been used in previous questions
      const availableQuestions = allQuestionsPool.filter(
        q => q.id !== currentQuestionId && 
             !otherQuestionIds.has(q.id) && 
             !usedQuestionIds.has(q.id)
      );
      
      let newQuestion: BattleQuestion;
      
      if (availableQuestions.length === 0) {
        // If no unused questions, try any question that's not the current one and not in quiz
        const alternativeQuestions = allQuestionsPool.filter(
          q => q.id !== currentQuestionId && !otherQuestionIds.has(q.id)
        );
        if (alternativeQuestions.length === 0) {
          alert('No alternative questions available');
          return;
        }
        
        // Pick a random alternative question
        const randomIndex = Math.floor(Math.random() * alternativeQuestions.length);
        newQuestion = alternativeQuestions[randomIndex];
      } else {
        // Pick a random unused question
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        newQuestion = availableQuestions[randomIndex];
      }
      
      // Replace current question in the questions array
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex] = newQuestion;
      setQuestions(updatedQuestions);
      
      // Mark the old question as used (so it won't appear again)
      setUsedQuestionIds(prev => {
        const updated = new Set(prev);
        updated.add(currentQuestionId);
        return updated;
      });
      
      // Reset any active lifelines for the new question
      setActiveFiftyFifty(false);
      setRemovedOptions([]);
      setActiveAudiencePoll(false);
      setAudiencePollPercentages({});
      if (audiencePollIntervalRef.current) {
        clearInterval(audiencePollIntervalRef.current);
      }
      setSelectedAnswer(null);
    }
  };

  const checkWinner = async (finalUserScore: number, finalOpponentScore: number) => {
    if (hasAwardedCoins.current) return;
    if (hasAwardedCoins.current) return; // Double check after delay
    hasAwardedCoins.current = true;

    const userWon = finalUserScore > finalOpponentScore;

    if (userWon) {
      const coinAmount = 100;
      
      // Check if user is authenticated (quick check from localStorage)
      const storedUser = localStorage.getItem('user');
      let currentUser = null;
      let isAuthenticated = false;
      
      if (storedUser) {
        try {
          currentUser = JSON.parse(storedUser);
          isAuthenticated = !!(currentUser && currentUser.id);
        } catch (e) {
          console.error('Error parsing stored user:', e);
        }
      }

      if (isAuthenticated && currentUser && currentUser.id) {
        // Authenticated user - OPTIMISTIC UPDATE: Update UI immediately
        const updatedCoins = (currentUser.coins || 0) + coinAmount;
        const updatedUser = { ...currentUser, coins: updatedCoins };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));

        // Trigger coins update event immediately to update navbar
        window.dispatchEvent(new Event('coinsUpdated'));
        
        // Show win popup immediately
        setShowWinPopup(true);
        
        console.log(`✅ Coins awarded (optimistic): ${coinAmount} for winning battle. New balance: ${updatedCoins}`);
        
        // Then award coins via API in background (creates history)
        (async () => {
          try {
            const result = await authApi.awardCoins(coinAmount, `Won battle: ${battle?.name || 'Battle'}`, battleId);

            // Fetch fresh user data from API to sync with server
            try {
              const freshUserData = await authApi.getCurrentUser();
              setUser(freshUserData);
              localStorage.setItem('user', JSON.stringify(freshUserData));
              window.dispatchEvent(new Event('coinsUpdated'));
              console.log(`✅ Coins synced with server. New balance: ${freshUserData.coins || 0}`);
            } catch (fetchErr) {
              // If fetching fails, use result from awardCoins
              const serverCoins = result.coins || updatedCoins;
              const serverUser = { ...currentUser, coins: serverCoins };
              setUser(serverUser);
              localStorage.setItem('user', JSON.stringify(serverUser));
              window.dispatchEvent(new Event('coinsUpdated'));
            }
          } catch (awardErr: any) {
            console.error('Error awarding coins:', awardErr);
            // Revert optimistic update on error
            setUser(currentUser);
            localStorage.setItem('user', JSON.stringify(currentUser));
            window.dispatchEvent(new Event('coinsUpdated'));
          }
        })();
      } else {
        // Guest user - award coins instantly (no history saved)
        const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
        const newGuestCoins = currentGuestCoins + coinAmount;
        localStorage.setItem('guestCoins', newGuestCoins.toString());
        
        // Trigger coins update event immediately to update navbar
        window.dispatchEvent(new Event('coinsUpdated'));
        
        // Show win popup immediately
        setShowWinPopup(true);
        
        console.log(`✅ Coins awarded to guest: ${coinAmount} for winning battle. New balance: ${newGuestCoins}`);
      }
    } else {
      console.log(`Game result: User score ${finalUserScore} vs Opponent score ${finalOpponentScore} - No coins awarded`);
    }
  };

  const getImageUrl = (imagePath: string | null) => {
    if (!imagePath) return null;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    if (imagePath.startsWith('http')) return imagePath;
    return `${baseUrl}/${imagePath}`;
  };

  const getUserImage = () => {
    if (user?.picture) {
      return user.picture;
    }
    return '/defaultpf.svg';
  };

  const getUserName = () => {
    if (user?.name) {
      return user.name;
    }
    return 'You';
  };

  const getOpponentImage = () => {
    // Get opponent image index from localStorage
    const opponentIndex = localStorage.getItem('battleOpponentIndex');
    const index = opponentIndex ? parseInt(opponentIndex) : 1;
    return `/p${index}.svg`;
  };

  if (loading || !battle || questions.length === 0) {
    return (
      <>
        <SEOHead title="Loading Battle..." description="Loading battle..." />
        <DashboardNav />
        <LoadingScreen message="Preparing your battle..." fullPage />
        <Footer />
      </>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  return (
    <>
      <SEOHead
        title={`${battle.name} - Battle Game`}
        description={`Playing battle: ${battle.name || 'Battle'}`}
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#0D0009] text-white p-4 sm:p-5 md:p-6 relative overflow-x-hidden overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Audio elements (same as contest) */}
        <audio ref={battleMusicRef} src="/background-music.mp3" loop preload="auto" />
        <audio ref={correctSoundRef} src="/correct-sound.wav" preload="auto" />
        <audio ref={wrongSoundRef} src="/wrong-sound.wav" preload="auto" />

        {gameStarted && !gameCompleted && (
          <>
            {/* Timer Pill (like screenshot) */}
            <div className="flex justify-center mb-3 sm:mb-4">
              <div className="bg-[rgba(255,255,255,0.15)] backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2  shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
                <img src="/stopwatch.svg" alt="Timer" className="w-6 h-6 opacity-90" />
                <span className="text-white font-semibold text-sm">{formatTimerPill(questionTimeRemaining)}</span>
                  </div>
                </div>

            {/* Progress Bars Section */}
            <div className="max-w-4xl mx-auto mb-4 sm:mb-6 px-1 sm:px-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <img 
                    src={getUserImage()} 
                    alt={getUserName()} 
                    className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full object-cover border-2 sm:border-3 border-white flex-shrink-0"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = '/defaultpf.svg';
                    }}
                  />
                  <div className="flex flex-col">
                    <div className="text-sm sm:text-base md:text-lg font-semibold text-[#FFFFFF] leading-tight">{getUserName()}</div>
                    <div className="text-xs sm:text-sm md:text-base font-bold text-[#FFD602] leading-tight">Score: {userScore}</div>
                </div>
              </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-row-reverse">
                  <img 
                    src={getOpponentImage()} 
                    alt={opponentName} 
                    className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full object-cover border-2 sm:border-3 border-white flex-shrink-0"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = '/defaultpf.svg';
                    }}
                  />
                  <div className="flex flex-col">
                    <div className="text-sm sm:text-base md:text-lg font-semibold text-[#FFFFFF] text-right leading-tight">{opponentName || 'Opponent'}</div>
                    <div className="text-xs sm:text-sm md:text-base font-bold text-[#ED4762] text-right leading-tight">Score: {opponentScore}</div>
                  </div>
                </div>
              </div>

              {/* Battle Meter (single bar like screenshot) */}
              <div className="relative">
                {/* Bar (clipped) */}
                <div className="relative h-[4px] sm:h-[4px] rounded-full bg-[rgba(255,246,217,0.18)] overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-[#FBD457] transition-all duration-300"
                    style={{ width: `${userProgress}%` }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-[#ED4762] transition-all duration-300"
                    style={{ width: `${opponentProgress}%` }}
                  />
                </div>

                {/* Battle badge moves with score boundary */}
                <div
                  className="absolute top-0 -translate-x-1/2 -translate-y-[55%] bg-transparent z-10 pointer-events-none transition-all duration-300"
                  style={{
                    left: `${clamp(userProgress, 4, 96)}%`,
                  }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
                    <img src="/battle.svg" alt="Battle" className="w-8 h-8 object-contain" />
                  </div>
                </div>
              </div>
            </div>

            {/* Question Section */}
            <div 
              className={`max-w-4xl mx-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-[0_12px_48px_rgba(0,0,0,0.4)] relative overflow-visible mt-6 sm:mt-10 md:mt-14 mb-16 sm:mb-20 md:mb-24 transition-colors duration-300 ${
                freezeTimeActive ? 'bg-blue-200' : 'bg-[#FFF6D9]'
              }`}
            >
              {/* Music Button (inside question card like screenshot) */}
              <div className="absolute top-3 right-3 z-20">
                <button
                  onClick={toggleMute}
                  className="bg-[#0D0009] hover:bg-[#0D0009]/80 rounded-full p-2 transition-all duration-300 hover:scale-110 border border-[#FFF6D9]/30"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {(() => {
                    // Show unmuted icon when not muted, muted icon when muted
                    const showUnmuted = !isMuted;
                    return showUnmuted ? (
                      <svg className="w-6 h-6 text-[#FFF6D9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-[#FFF6D9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    );
                  })()}
                </button>
              </div>

              {/* Question Number */}
              <div className="text-center text-xs sm:text-sm text-[#0D0009] mb-3 sm:mb-4 mt-2 font-semibold">
                Question {currentQuestionIndex + 1}/{totalQuestions}
              </div>

              {/* Freeze Active Indicator */}
              {freezeTimeActive && (
                <div className="text-center mb-2">
                  <div className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-full">
                    <span className="text-xs sm:text-sm font-semibold">⏸️ Timer Frozen</span>
                    <span className="text-xs sm:text-sm font-bold">{freezeCountdown}s</span>
                  </div>
                </div>
              )}

              {/* Question Card */}
              <div className="rounded-2xl p-0.5 mb-4 sm:mb-6 min-h-[4rem] sm:min-h-[5.625rem] flex flex-col items-center justify-center">
                <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-[#0D0009] text-center leading-relaxed m-0 break-words px-2 mb-3 sm:mb-4">{currentQuestion.question}</p>
                {currentQuestion.media && getImageUrl(currentQuestion.media) && currentQuestion.type === 'IMAGE' && (
                  <img
                    src={getImageUrl(currentQuestion.media)!}
                    alt="Question media"
                    className="max-w-full max-h-24 sm:max-h-40 md:max-h-48 rounded-xl object-contain"
                  />
                )}
                {currentQuestion.media && currentQuestion.type === 'VIDEO' && (
                  <video
                    src={getImageUrl(currentQuestion.media)!}
                    controls
                    className="max-w-full max-h-48 sm:max-h-64 md:max-h-80 rounded-xl object-contain"
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                {currentQuestion.media && currentQuestion.type === 'AUDIO' && (
                  <audio
                    src={getImageUrl(currentQuestion.media)!}
                    controls
                    className="w-full max-w-md"
                  >
                    Your browser does not support the audio tag.
                  </audio>
                )}
              </div>

              {/* Answer Options */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8 md:mb-10">
                {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? (
                  currentQuestion.options.map((option, index) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === currentQuestion.correctOption;
                    const showResult = selectedAnswer !== null;
                    const showAudiencePoll = activeAudiencePoll;
                    const isRemovedByFiftyFifty = activeFiftyFifty && removedOptions.includes(option);

                    let bgColor = 'answer-option';
                    let pollBarColor = '';
                    let showThumbsUp = false;
                    let pollPercentage = 0;

                    if (showAudiencePoll) {
                      // During audience poll animation - white background with colored bars
                      bgColor = 'answer-option answer-audience-poll';
                      pollPercentage = audiencePollPercentages[option] || (isCorrect ? 45 : 15);
                      
                      if (isCorrect) {
                        pollBarColor = 'bg-green-400';
                        showThumbsUp = true;
                      } else {
                        pollBarColor = 'bg-purple-300';
                      }
                    } else if (showResult) {
                      if (isCorrect) {
                        bgColor = 'answer-option answer-correct';
                      } else if (isSelected && !isCorrect) {
                        bgColor = 'answer-option answer-wrong';
                      }
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={selectedAnswer !== null || questionTimeRemaining <= 0 || isRemovedByFiftyFifty}
                        className={`
                          ${isRemovedByFiftyFifty ? 'opacity-0 invisible pointer-events-none cursor-not-allowed' : ''}
                          ${showResult && isCorrect ? 'bg-green-500 text-white border-green-500 animate-pulse' : ''}
                          ${showResult && isSelected && !isCorrect ? 'bg-red-500 text-white border-red-500 animate-shake' : ''}
                          ${showResult && !isCorrect && !isSelected ? 'bg-white/90 text-[#0D0009]/90 border-[#FFF6D9]/40' : ''}
                          ${!showResult && !showAudiencePoll ? 'bg-white text-[#0D0009] hover:bg-gray-100 hover:border-[#FFF6D9] hover:-translate-y-0.5 hover:shadow-md' : ''}
                          ${showAudiencePoll ? 'bg-white text-[#0D0009]' : ''}
                          border-2 border-transparent rounded-xl p-3 sm:p-4 text-sm sm:text-base font-semibold cursor-pointer transition-all duration-300 text-center break-words relative overflow-hidden min-h-[2.75rem] sm:min-h-[3.5rem] flex items-center justify-center
                          disabled:cursor-not-allowed disabled:opacity-100
                        `}
                      >
                        {showAudiencePoll && (
                          <div 
                            className={`absolute left-0 top-0 h-full transition-all duration-300 animate-pulse ${pollBarColor}`}
                            style={{ width: `${pollPercentage}%` }}
                          />
                        )}
                        <span className={`relative z-10 block w-full ${isRemovedByFiftyFifty ? 'invisible' : ''}`}>
                          <span className={`block w-full text-center ${isRemovedByFiftyFifty ? 'invisible' : ''}`}>{option}</span>
                          {showAudiencePoll && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-80">
                              {Math.round(pollPercentage)}%
                            </span>
                          )}
                        </span>
                        {showAudiencePoll && showThumbsUp && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg sm:text-xl z-10">👍</span>
                        )}
                      </button>
                    );
                  })
                ) : null}
              </div>

              {/* Lifelines Section */}
              {showingLifelineSelection && (
                <div className="mt-4 sm:mt-5 py-4 sm:py-5">
                  {/* Lifeline Options */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
                    {/* 50/50 Lifeline */}
                    <div className="flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setShowingLifelineSelection(false);
                          handleLifeline('fifty-fifty');
                        }}
                        disabled={usedLifelines.has('fifty-fifty') || hasUsedLifelineThisQuestion}
                        className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg bg-[#0D0009] border-none flex items-center justify-center cursor-pointer transition-all duration-300 p-0 hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[2.75rem] sm:min-h-[3rem]"
                      >
                        <img src="/fifty-fifty.svg" alt="50/50" className="w-5 h-5 sm:w-8 sm:h-8 object-contain" />
                      </button>
                      <span className="text-xs text-[#0D0009] font-semibold text-center">50/50</span>
                    </div>

                    {/* Audience Poll Lifeline */}
                    <div className="flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setShowingLifelineSelection(false);
                          handleLifeline('audience');
                        }}
                        disabled={usedLifelines.has('audience') || hasUsedLifelineThisQuestion}
                        className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg bg-[#0D0009] border-none flex items-center justify-center cursor-pointer transition-all duration-300 p-0 hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[2.75rem] sm:min-h-[3rem]"
                      >
                        <img src="/audience.svg" alt="Audience" className="w-5 h-5 sm:w-8 sm:h-8 object-contain" />
                      </button>
                      <span className="text-xs text-[#0D0009] font-semibold text-center">Audience</span>
                    </div>

                    {/* Freeze Timer Lifeline */}
                    <div className="flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setShowingLifelineSelection(false);
                          handleLifeline('freeze');
                        }}
                        disabled={usedLifelines.has('freeze') || hasUsedLifelineThisQuestion}
                        className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg bg-[#0D0009] border-none flex items-center justify-center cursor-pointer transition-all duration-300 p-0 hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[2.75rem] sm:min-h-[3rem]"
                      >
                        <img src="/freeze.svg" alt="Freeze" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
                      </button>
                      <span className="text-xs text-[#0D0009] font-semibold text-center">Freeze</span>
                      <span className="text-[9px] text-[#0D0009]/70 text-center">30 sec freeze</span>
                    </div>

                    {/* Flip Question Lifeline */}
                    <div className="flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setShowingLifelineSelection(false);
                          handleLifeline('flip');
                        }}
                        disabled={usedLifelines.has('flip') || hasUsedLifelineThisQuestion}
                        className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg bg-[#0D0009] border-none flex items-center justify-center cursor-pointer transition-all duration-300 p-0 hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[2.75rem] sm:min-h-[3rem]"
                      >
                        <img src="/flip.svg" alt="Flip" className="w-5 h-5 sm:w-8 sm:h-8 object-contain" />
                      </button>
                      <span className="text-xs text-[#0D0009] font-semibold text-center">Flip</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Use Lifeline Button - Positioned at bottom edge */}
              {!showingLifelineSelection && (
                <div className="absolute -bottom-5 sm:-bottom- md:-bottom-4 left-1/2 transform -translate-x-1/2 z-10 pointer-events-auto">
                  <button
                    onClick={() => setShowingLifelineSelection(true)}
                    disabled={!gameStarted}
                    className="bg-[#FFF6D9] text-[#0D0009] rounded-full px-3 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-4 flex items-center justify-center gap-2 sm:gap-3 font-semibold  cursor-pointer transition-all duration-300 shadow-lg hover:bg-[#f0e8c0] hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm md:text-base whitespace-normal text-center leading-tight min-h-[1rem] sm:min-h-[1rem] md:min-h-[1rem]"
                  >
                    <img src="/lifeline.svg" alt="Lifeline" className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 object-contain flex-shrink-0" />
                    <span>USE A LIFELINE</span>
                  </button>
              </div>
              )}

              {/* Close Button - Positioned at bottom edge */}
              {showingLifelineSelection && (
                <div className="absolute -bottom-5 sm:-bottom-6 md:-bottom-8 left-1/2 transform -translate-x-1/2 z-10 pointer-events-auto">
                  <button
                    onClick={() => setShowingLifelineSelection(false)}
                    className="w-16 sm:w-20 md:w-24 bg-[#FFF6D9] text-[#0D0009] rounded-full px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-4 font-bold border-2 border-[#BFBAA7] cursor-pointer transition-all duration-300 shadow-lg hover:bg-[#f0e8c0] hover:scale-105 hover:shadow-xl text-xs sm:text-sm md:text-base min-h-[2.5rem] sm:min-h-[2.75rem] md:min-h-[3rem]"
                  >
                    CLOSE
                  </button>
            </div>
              )}
            </div>

          </>
        )}

        {gameCompleted && (() => {
          if (!finalResults) {
            return null;
          }

          const totalQ = finalResults.totalQ;
          const userCorrect = finalResults.userCorrect;
          const oppCorrect = finalResults.oppCorrect;

          const userAccuracyPct = totalQ > 0 ? (userCorrect / totalQ) * 100 : 0;
          const oppAccuracyPct = totalQ > 0 ? (oppCorrect / totalQ) * 100 : 0;

          const userSpeed = finalResults.userSpeed;
          const oppSpeed = finalResults.oppSpeed;
          const maxSpeed = Math.max(1, totalQ * (QUESTION_TIME_LIMIT_SECONDS - 1));
          const userSpeedPct = (userSpeed / maxSpeed) * 100;
          const oppSpeedPct = (oppSpeed / maxSpeed) * 100;

          const userLifelinesUsed = finalResults.userLifelinesUsed;
          const oppLifelinesUsed = finalResults.oppLifelinesUsed;
          const userLifelinesPct = (userLifelinesUsed / 4) * 100;
          const oppLifelinesPct = (oppLifelinesUsed / 4) * 100;

          const userWon = finalResults.userScore > finalResults.opponentScore;
          const userLost = finalResults.userScore < finalResults.opponentScore;

          const userScoreColor = userWon ? '#3DDC84' : userLost ? '#ED4762' : '#FFD602';
          const oppScoreColor = !userWon && userLost ? '#3DDC84' : userWon ? '#ED4762' : '#FFD602';

          const StatRow = (props: {
            label: string;
            leftValue: string;
            rightValue: string;
            leftPct: number;
            rightPct: number;
            barColor: string;
            centerIcon: React.ReactNode;
            invertBars?: boolean; // for lifelines (higher is worse)
          }) => (
            <div className="grid grid-cols-[1fr_40px_1fr] gap-2 items-center">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-[#0D0009] tracking-wide">{props.label}</span>
                  <span className="text-sm font-bold text-[#0D0009]">{props.leftValue}</span>
                      </div>
                <div className="mt-2 h-2 rounded-full bg-black/20 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${clamp(props.leftPct, 0, 100)}%`,
                      backgroundColor: props.barColor,
                    }}
                  />
                  </div>
                  </div>

              <div className="flex items-center justify-center">{props.centerIcon}</div>

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-[#0D0009] tracking-wide">{props.label}</span>
                  <span className="text-sm font-bold text-[#0D0009]">{props.rightValue}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-black/20 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${clamp(props.rightPct, 0, 100)}%`,
                      backgroundColor: props.barColor,
                    }}
                      />
                    </div>
                  </div>
                </div>
          );

          return (
            <div className="max-w-md mx-auto pb-8">
              <div className="text-center mt-6">
                <div className={`text-2xl font-extrabold tracking-wide ${userWon ? 'text-[#3DDC84]' : userLost ? 'text-[#ED4762]' : 'text-[#FFD602]'}`}>
                  {userWon ? 'YOU WIN' : userLost ? 'YOU LOSE' : 'DRAW'}
                </div>
                <div className="text-sm font-semibold text-white mt-2 uppercase tracking-wide">
                  {battle?.name || 'BATTLE'}
                </div>
                </div>

              <div className="mt-6 flex items-center justify-between px-4">
                <div className="flex flex-col items-center">
                  <div className="relative">
                    {userWon && (
                      <>
                        {/* Twinkling Stars */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2">
                          {/* Left Star */}
                          <svg 
                            className="w-4 h-4"
                            style={{
                              animation: 'twinkle 1.5s ease-in-out infinite',
                              animationDelay: '0s'
                            }}
                            viewBox="0 0 24 24"
                            fill="#FFD602"
                          >
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                          </svg>
                          {/* Middle Star (bigger) */}
                          <svg 
                            className="w-5 h-5"
                            style={{
                              animation: 'twinkle 1.5s ease-in-out infinite',
                              animationDelay: '0.5s'
                            }}
                            viewBox="0 0 24 24"
                            fill="#FFD602"
                          >
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                          </svg>
                          {/* Right Star */}
                          <svg 
                            className="w-4 h-4"
                            style={{
                              animation: 'twinkle 1.5s ease-in-out infinite',
                              animationDelay: '1s'
                            }}
                            viewBox="0 0 24 24"
                            fill="#FFD602"
                          >
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                        </svg>
                      </div>
                        <img
                          src="/crown1.svg"
                          alt="Winner"
                          className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)] z-10"
                        />
                      </>
                    )}
                    <img src={getUserImage()} alt={getUserName()} className="w-16 h-16 rounded-full object-cover border-2 border-white/50" />
                  </div>
                  <div className="text-white mt-2 text-sm font-semibold">{getUserName()}</div>
                  <div className="mt-1 text-lg font-black">
                    <span style={{ color: userScoreColor }}>{finalResults.userScore}</span>
                    <span className="text-white"> /100</span>
                  </div>
                </div>

                <img src="/vss.svg" alt="Vs" className="w-18 h-18 object-contain" /> 

                <div className="flex flex-col items-center">
                  <div className="relative">
                    {userLost && (
                      <>
                        {/* Twinkling Stars */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2">
                          {/* Left Star */}
                          <svg 
                            className="w-4 h-4"
                            style={{
                              animation: 'twinkle 1.5s ease-in-out infinite',
                              animationDelay: '0s'
                            }}
                            viewBox="0 0 24 24"
                            fill="#FFD602"
                          >
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                          </svg>
                          {/* Middle Star (bigger) */}
                          <svg 
                            className="w-5 h-5"
                            style={{
                              animation: 'twinkle 1.5s ease-in-out infinite',
                              animationDelay: '0.5s'
                            }}
                            viewBox="0 0 24 24"
                            fill="#FFD602"
                          >
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                          </svg>
                          {/* Right Star */}
                          <svg 
                            className="w-4 h-4"
                            style={{
                              animation: 'twinkle 1.5s ease-in-out infinite',
                              animationDelay: '1s'
                            }}
                            viewBox="0 0 24 24"
                            fill="#FFD602"
                          >
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                          </svg>
                        </div>
                        <img
                          src="/crown1.svg"
                          alt="Winner"
                          className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)] z-10"
                        />
                      </>
                    )}
                    <img src={getOpponentImage()} alt={opponentName} className="w-16 h-16 rounded-full object-cover border-2 border-white/50" />
                  </div>
                  <div className="text-white mt-2 text-sm font-semibold">{opponentName || 'Opponent'}</div>
                  <div className="mt-1 text-lg font-black">
                    <span style={{ color: oppScoreColor }}>{finalResults.opponentScore}</span>
                    <span className="text-white"> /100</span>
                    </div>
                  </div>
                </div>

              <div className="mt-6 bg-[#FFF6D9] rounded-2xl px-4 py-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                <div className="text-center text-[#0D0009] font-extrabold tracking-wide mb-4">
                  GAME STATES
                </div>

                <div className="space-y-5">
                  <StatRow
                    label="ACCURACY"
                    leftValue={`${userCorrect}/${totalQ}`}
                    rightValue={`${oppCorrect}/${totalQ}`}
                    leftPct={userAccuracyPct}
                    rightPct={oppAccuracyPct}
                    barColor="#34A853"
                    centerIcon={
                      <div className="w-7 h-7   flex items-center justify-center ">
                        <img src="/tick.svg" alt="Accuracy" className="w-7 h-7 object-contain" />
              </div>
                    }
                  />

                  <StatRow
                    label="SPEED"
                    leftValue={`${userSpeed}`}
                    rightValue={`${oppSpeed}`}
                    leftPct={userSpeedPct}
                    rightPct={oppSpeedPct}
                    barColor="#FBD457"
                    centerIcon={
                      <div className="w-7 h-7   flex items-center justify-center ">
                      <img src="/timer-arg.svg" alt="timee" className="w-7 h-7 object-contain" />
                    </div>
                    }
                  />

                  <StatRow
                    label="LIFELINE USED"
                    leftValue={`${userLifelinesUsed}/4`}
                    rightValue={`${oppLifelinesUsed}/4`}
                    leftPct={userLifelinesPct}
                    rightPct={oppLifelinesPct}
                    barColor="#ED4762"
                    centerIcon={
                      <div className="w-7 h-7   flex items-center justify-center ">
                      <img src="/health.svg" alt="Accuracy" className="w-7 h-7 object-contain" />
                    </div>
                    }
                  />
                </div>
              </div>

              <button
                className="mt-6 w-full bg-[#FBD457] text-[#0D0009] font-black py-4 rounded-xl shadow-lg"
                onClick={() => router.push('/battles')}
              >
                PLAY AGAIN
              </button>

              {/* Advertisement like screenshot */}
              <div className="mt-6">
                <p className="text-center text-white text-xs mb-2 opacity-70">ADVERTISEMENT</p>
                <div className="w-full overflow-hidden">
                  <AdsenseAd adSlot="8153775072" adFormat="auto" />
                </div>
              </div>

              {/* Other Battles */}
              {otherBattles.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-white text-xl font-bold mb-4">Other Battles</h2>
                  <div className="space-y-3">
                    {otherBattles.map((otherBattle) => {
                      const topColor = otherBattle.backgroundColorTop || '#C0FFE3';
                      const bottomColor = otherBattle.backgroundColorBottom || '#00AB5E';
                      const battleImageUrl = otherBattle.imageUrl || getBattleImageUrl(otherBattle.imagePath, 'battles');
                      
                      return (
                        <div
                          key={otherBattle.id}
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
                                alt={otherBattle.name}
                                className="w-full h-full object-contain p-1.5"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  img.style.display = 'none';
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
                              {otherBattle.name}
                            </h3>
                          </div>

                          {/* Right - Play Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/battles/${otherBattle.id}/rules`);
                            }}
                            className="bg-[#FFD602] text-[#0D0009] font-bold px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg hover:bg-[#FFE033] transition-colors flex-shrink-0 text-xs sm:text-sm"
                          >
                            Play
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Win Popup - Congratulations */}
      {showWinPopup && (
        <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4">
          <div className="bg-[#0D0009] rounded-xl p-4 sm:p-5 max-w-xs w-full border border-[rgba(255,246,217,0.2)] shadow-[0px_0px_2px_0px_#FFF6D9] text-center" style={{ animation: 'fadeInScale 0.3s ease' }}>
            {/* Coin Icon with Animation */}
            <div className="flex justify-center mb-3 animate-bounce">
              <img src="/coin.svg" alt="Coins" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
            </div>
            
            {/* Congratulations Message */}
            <h3 className="text-[#FFF6D9] text-lg sm:text-xl font-bold mb-1.5">
              Congratulations!
            </h3>
            <p className="text-[rgba(255,246,217,0.9)] mb-4 leading-relaxed text-sm sm:text-base">
              You won <span className="font-bold text-[#FFD602]">100 coins</span>
            </p>
            
            {/* Close Button */}
            <button
              onClick={() => setShowWinPopup(false)}
              className="w-full bg-[#FFD602] text-[#0D0009] font-bold px-4 py-2 rounded-lg border-none cursor-pointer transition-all duration-300 hover:bg-[#FFC700] hover:scale-105 shadow-lg text-sm sm:text-base"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      {/* Insufficient Coins Modal (Watch Video) */}
      {showingLifelineModal && (
        <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4 sm:p-5">
          <div className="bg-[#0D0009] rounded-2xl p-6 sm:p-8 max-w-md sm:max-w-lg w-full border border-[rgba(255,246,217,0.2)] shadow-[0px_0px_2px_0px_#FFF6D9] max-h-[90vh] overflow-y-auto">
            <h3 className="text-[#FFF6D9] text-lg sm:text-xl font-bold mb-4">Insufficient Coins</h3>
            <p className="text-[rgba(255,246,217,0.8)] mb-4 leading-relaxed text-sm sm:text-base">
              You need {(battle as any)?.lifeLineCharge || 0} coins to use this lifeline. 
              Watch a video to earn coins!
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleWatchVideoForLifeline}
                className="flex-1 bg-[#FFD602] text-[#0D0009] font-bold px-4 py-3 rounded-lg border-none cursor-pointer relative overflow-hidden transition-all duration-300 hover:bg-[#FFC700] min-h-[2.75rem] sm:min-h-[3rem]"
              >
                <span>Watch Video</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></span>
              </button>
              <button
                onClick={() => setShowingLifelineModal(null)}
                className="flex-1 bg-[#0D0009] text-[#FFF6D9] font-bold px-4 py-3 rounded-lg border border-[rgba(255,246,217,0.3)] cursor-pointer transition-all duration-300 hover:bg-[rgba(13,0,9,0.8)] min-h-[2.75rem] sm:min-h-[3rem]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
