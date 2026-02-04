'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeadNav } from '@/components/headnav';
import { WrongAnswerPopup } from '@/components/WrongAnswerPopup';
import { QuizResultCard } from '@/components/QuizResultCard';
import { SEOHead } from '@/components/SEOHead';

interface AnswerResult {
  questionId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function ResultPage() {
  const router = useRouter();
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [showPopup, setShowPopup] = useState(true);
  const [coinsAwarded, setCoinsAwarded] = useState(0);

  useEffect(() => {
    // Get results from sessionStorage
    const storedResults = sessionStorage.getItem('quizResults');
    if (storedResults) {
      const parsedResults = JSON.parse(storedResults);
      setResults(parsedResults);
      
      // Calculate coins based on correct answers
      const correctCount = parsedResults.filter((r: AnswerResult) => r.isCorrect).length;
      if (correctCount === 2) {
        // Both correct - award 200 coins
        setCoinsAwarded(200);
        setShowPopup(false); // Don't show popup for both correct
      } else {
        // One or both wrong - show popup to watch ad for 200 coins
        setCoinsAwarded(0);
        setShowPopup(true);
      }
    } else {
      // No results found, redirect back to intro
      router.push('/intro');
    }
  }, [router]);

  const handleWatchAd = () => {
    // TODO: Implement ad watching logic
    // For now, just award coins and close popup
    setCoinsAwarded(200);
    setShowPopup(false);
    // You can add actual ad integration here
  };

  const handleClose = () => {
    setShowPopup(false);
  };

  const correctCount = results.filter(r => r.isCorrect).length;
  const shouldShowPopup = showPopup && correctCount < 2;

  return (
    <>
      <SEOHead 
        title="Quiz Results - View Your Quiz Score | Quizwala"
        description="View your quiz results and performance on Quizwala. See your score, correct answers, coins earned, and compare your results with other players."
        keywords="quiz results, quiz score, quiz results, quiz performance, quiz results page"
      />
      <HeadNav />
      <div className="min-h-screen p-5 pb-10">
        {/* Result Content - Show when popup is closed or both answers correct */}
        {(!shouldShowPopup || correctCount === 2) && (
          <QuizResultCard
            correctCount={correctCount}
            coinsAwarded={coinsAwarded}
            onPlayAgain={() => router.push('/intro')}
          />
        )}

        {/* Wrong Answer Popup */}
        {shouldShowPopup && (
          <WrongAnswerPopup
            correctCount={correctCount}
            onWatchAd={handleWatchAd}
            onClose={handleClose}
          />
        )}

        {/* Background Content (visible when popup is closed) */}
        {!shouldShowPopup && (
          <div className="text-center text-white py-8">
            <div className="flex items-center justify-center gap-2.5 mb-5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl border-2 border-white">
                🧠
              </div>
              <h2 className="text-xl font-bold">Quizwala</h2>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

