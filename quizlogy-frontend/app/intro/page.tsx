'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Question, funfactsApi, FunFact, authApi, twoQuestionsApi } from '@/lib/api';
import { visitorTrackingApi } from '@/lib/visitorTracking';
import { HeadNav } from '@/components/headnav';
import { QuestionCard } from '@/components/QuestionCard'; 
import { QuizResultCard } from '@/components/QuizResultCard';
import { WrongAnswerPopup } from '@/components/WrongAnswerPopup';
import AdsenseAd from '@/components/AdsenseAd';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

interface AnswerResult {
  questionId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function IntroPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [funfacts, setFunfacts] = useState<FunFact[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [coinsAwarded, setCoinsAwarded] = useState(0);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // If user has played intro in the last 1 hour, redirect to dashboard (no replay)
    const lastPlayedTimestamp = localStorage.getItem('introLastPlayed');
    const oneHourInMs = 60 * 60 * 1000;

    if (lastPlayedTimestamp) {
      const lastPlayed = parseInt(lastPlayedTimestamp, 10);
      const timeDifference = Date.now() - lastPlayed;
      if (timeDifference < oneHourInMs) {
        router.push('/dashboard');
        return;
      }
    }

    checkGuestMode();
    fetchRandomQuestions();
    fetchRandomFunfacts();
  }, [router]);

  const checkGuestMode = () => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      setIsGuest(true);
      // Initialize guest coins if not exists
      if (!localStorage.getItem('guestCoins')) {
        localStorage.setItem('guestCoins', '0');
      }
    }
  };

  const fetchRandomQuestions = async () => {
    try {
      setLoading(true);
      
      // Get user country code for intro questions (e.g. "IN", "US")
      let country: string | undefined;
      try {
        const visitorData = await visitorTrackingApi.getVisitorInfo();
        const visitor = visitorData?.visitor;
        if (visitor?.countryCode && visitor.countryCode !== 'UN') {
          country = visitor.countryCode; // ISO code e.g. "IN", "US"
          localStorage.setItem('userCountryCode', visitor.countryCode);
        }
      } catch {
        // Backend will derive country from request IP if we don't pass it
      }

      // Get previously shown question IDs from localStorage
      const shownQuestionIds = JSON.parse(localStorage.getItem('introShownQuestionIds') || '[]');

      // Fetch random two questions filtered by user country
      const selectedQuestions = await twoQuestionsApi.getRandom(2, shownQuestionIds, country);

      if (selectedQuestions.length === 0) {
        // If no questions available, reset the tracking and try again
        localStorage.setItem('introShownQuestionIds', '[]');
        const retryQuestions = await twoQuestionsApi.getRandom(2, [], country);
        if (retryQuestions.length === 0) {
          throw new Error('No questions available');
        }
        setQuestions(retryQuestions);
        // Store the new question IDs
        const newQuestionIds = retryQuestions.map(q => q.id);
        localStorage.setItem('introShownQuestionIds', JSON.stringify(newQuestionIds));
      } else {
        setQuestions(selectedQuestions);
        
        // Check if any of the returned questions were in our exclude list
        // This means the backend reset because we've shown all questions
        const returnedIds = selectedQuestions.map(q => q.id);
        const wereExcluded = returnedIds.some(id => shownQuestionIds.includes(id));
        
        if (wereExcluded) {
          // Backend reset - all questions were shown, start fresh with these new questions
          localStorage.setItem('introShownQuestionIds', JSON.stringify(returnedIds));
        } else {
          // Normal case - add new question IDs to the tracking list
          const updatedShownIds = [...shownQuestionIds, ...returnedIds];
          localStorage.setItem('introShownQuestionIds', JSON.stringify(updatedShownIds));
        }
      }
    } catch (err) {
      console.error('Error fetching questions from API:', err);
      setError('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRandomFunfacts = async () => {
    try {
      const data = await funfactsApi.getAll('ACTIVE');
      
      // Filter funfacts that have descriptions
      const funfactsWithDescriptions = data.filter(f => f.description && f.description.trim().length > 0);
      
      if (funfactsWithDescriptions.length === 0) {
        return;
      }
      
      // Shuffle and get 5 random funfacts (no duplicates)
      const shuffled = [...funfactsWithDescriptions].sort(() => Math.random() - 0.5);
      const randomFunfacts = shuffled.slice(0, Math.min(6, funfactsWithDescriptions.length));
      
      setFunfacts(randomFunfacts);
    } catch (err) {
      console.error('Error fetching funfacts:', err);
      // Don't set error, just continue without funfacts
    }
  };

  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer) return; // Prevent changing answer once selected
    setSelectedAnswer(option);
    
    // Save the answer result
    const currentQ = questions[currentQuestionIndex];
    const isCorrect = option === currentQ.correctOption;
    const answerResult: AnswerResult = {
      questionId: currentQ.id,
      selectedAnswer: option,
      correctAnswer: currentQ.correctOption,
      isCorrect,
    };
    
    const newAnswers = [...answers, answerResult];
    setAnswers(newAnswers);
    
    // If this is the last question, show results on the same page
    if (currentQuestionIndex === questions.length - 1) {
      setTimeout(async () => {
        // Calculate coins based on correct answers
        const correctCount = newAnswers.filter((r: AnswerResult) => r.isCorrect).length;
        let coinsToAward = 0;
        
        if (correctCount === 2) {
          // Both correct - award 200 coins
          coinsToAward = 200;
        } else if (correctCount === 1) {
          // One correct - award 100 coins
          coinsToAward = 100;
        } else {
          // Both incorrect - award 0 coins
          coinsToAward = 0;
        }
        
        // Award coins if any were earned
        if (coinsToAward > 0) {
          try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
              // Logged in user - award to account
              await authApi.awardCoins(coinsToAward, `Completed intro quiz with ${correctCount} correct answer${correctCount > 1 ? 's' : ''}`);
              const userData = await authApi.getCurrentUser();
              localStorage.setItem('user', JSON.stringify(userData));
            } else {
              // Guest user - store in localStorage
              const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
              localStorage.setItem('guestCoins', (currentGuestCoins + coinsToAward).toString());
            }
            setCoinsAwarded(coinsToAward); // Always show coins in UI
          } catch (err) {
            console.error('Error awarding coins:', err);
            // If API fails but user is guest, still award locally
            if (!localStorage.getItem('user')) {
              const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
              localStorage.setItem('guestCoins', (currentGuestCoins + coinsToAward).toString());
            }
            setCoinsAwarded(coinsToAward); // Still show in UI even if API call fails
          }
        } else {
          setCoinsAwarded(0);
        }
        
        // Don't show popup for now - commented out but kept for future use
        // To reuse the popup in the future:
        // 1. Uncomment the popup rendering below (around line 299)
        // 2. Set setShowPopup(true) when you want to show it (e.g., when correctCount < 2)
        // 3. The popup allows users to watch an ad to earn additional coins
        // 4. You can customize the popup behavior in handleWatchAd function
        setShowPopup(false);
        setQuizCompleted(true);
        // Save the current timestamp when intro is completed
        localStorage.setItem('introLastPlayed', Date.now().toString());
      }, 1000); // Show feedback for 1 second before showing results
    } else {
      // If not the last question, automatically move to next question after 1 second
      setTimeout(() => {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
      }, 1000); // Auto-advance after 1 second
    }
  };

  const handleWatchAd = async () => {
    // TODO: Implement ad watching logic
    // For now, just award coins and close popup
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        // Logged in user - award to account
        await authApi.awardCoins(200, 'Watched ad after intro quiz');
        const userData = await authApi.getCurrentUser();
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        // Guest user - store in localStorage
        const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
        localStorage.setItem('guestCoins', (currentGuestCoins + 200).toString());
      }
      setCoinsAwarded(200); // Always show coins in UI
    } catch (err) {
      console.error('Error awarding coins:', err);
      // If API fails but user is guest, still award locally
      if (!localStorage.getItem('user')) {
        const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
        localStorage.setItem('guestCoins', (currentGuestCoins + 200).toString());
      }
      setCoinsAwarded(200); // Still show in UI even if API call fails
    }
    setShowPopup(false);
    // You can add actual ad integration here
  };

  const handleClosePopup = () => {
    setShowPopup(false);
  };

  const handlePlayAgain = () => {
    // Reset quiz state (but keep the shown question IDs to avoid showing same questions)
    setQuizCompleted(false);
    setShowPopup(false);
    setCoinsAwarded(0);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    // Fetch new questions (will exclude previously shown ones)
    fetchRandomQuestions();
  };

  const currentQuestion = questions[currentQuestionIndex];
  const correctCount = answers.filter(r => r.isCorrect).length;
  const shouldShowPopup = showPopup && correctCount < 2;

  const noQuestions = !loading && questions.length === 0;
  

  return (<>
    <SEOHead 
      title="Play Quiz - Test Your Knowledge & Win Coins | Quizwala"
      description="Play exciting quizzes on Quizwala! Answer questions, test your knowledge, earn coins, and win prizes. Start playing now and challenge yourself!"
      keywords="play quiz, quiz game, test knowledge, quiz questions, earn coins, quiz contest"
    />
    {/* Header */}
    {/* <HeadNav /> */}
    {/* First Advertisement - Above the fold, before quiz content */}
    <div className="min-h-[291px] min-width-[490px] border-b border-[#564C53]">
    <p className="text-center text-white text-xs mt-2 mb-2 font-medium">ADVERTISEMENT</p>
      <div className="w-full overflow-hidden ">
        <AdsenseAd adSlot="8153775072" adFormat="auto" />
      </div>
    </div>
    <div className="min-h-screen  from-purple-800 via-purple-700 to-purple-900 px-5 py-0 pb-1 ">
    
      {/* Question Card Component or Result Card - Fixed height to prevent layout shift */}
      {noQuestions ? (
        <div className="max-w-md mx-auto mb-8 mt-10 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[#FBD457] text-black py-5 rounded-xl font-bold text-lg transition-transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden shadow-lg animate-pulse"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
            Tap to Play
          </button>
        </div>
      ) : !loading && questions.length > 0 ? (
        <div className="max-w-md mx-auto mb-8 ">
          {quizCompleted ? (
            <QuizResultCard
              correctCount={correctCount}
              coinsAwarded={coinsAwarded}
              onPlayAgain={handlePlayAgain}
            />
          ) : (
            <QuestionCard
              question={currentQuestion.question}
              options={currentQuestion.options}
              correctOption={currentQuestion.correctOption}
              selectedAnswer={selectedAnswer}
              currentQuestionNumber={currentQuestionIndex + 1}
              totalQuestions={questions.length}
              onAnswerSelect={handleAnswerSelect}
              disabled={!!selectedAnswer}
            />
          )}
        </div>
      ) : null}

      {/* Wrong Answer Popup - Currently commented out but kept for future use */}
      {/* 
        HOW TO REUSE THIS POPUP IN THE FUTURE:
        1. Uncomment the code below to show the popup
        2. In handleAnswerSelect function, set setShowPopup(true) when you want to show it
           (e.g., when correctCount < 2 or when user gets 0 coins)
        3. The popup component (WrongAnswerPopup) allows users to watch an ad to earn additional coins
        4. Customize the coin amount in handleWatchAd function (currently awards 200 coins)
        5. The popup shows when shouldShowPopup is true, which is calculated as: showPopup && correctCount < 2
        
        Example usage scenarios:
        - Show popup when user gets 0 coins (both wrong) to offer ad watching for coins
        - Show popup when user gets partial score to offer bonus coins via ad
        - Show popup as an incentive to improve their score next time
      */}
      {/* {shouldShowPopup && (
        <WrongAnswerPopup
          correctCount={correctCount}
          onWatchAd={handleWatchAd}
          onClose={handleClosePopup}
        />
      )} */}
      

        {/* Did You Know Section */}
       <div className="max-w-md mx-auto bg-[#FFF6D9] rounded-xl p-4 sm:p-5 mb-5 shadow-lg border-[#BFBAA7] border-3">
         <div className="flex items-start gap-2 sm:gap-2.5 mb-4">
           <div className="flex-shrink-0 mt-1">
             <img src="/b1.svg" alt="bulb" className="w-16 h-16 sm:w-20 sm:h-20" />
           </div>
           <div className='grid flex-1'>
             <h3 className="text-base sm:text-xl font-bold text-black">Did You Know?</h3>
             
               <p className="text-black text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4">
               Mind-blowing facts that most people never hear about.
               </p>
     
           </div>
           
         </div>
         
         {funfacts.length > 0 ? (
           <>
             {/* Show remaining funfacts as list items */}
             {funfacts.length > 1 && (
               <ul className="space-y-2 sm:space-y-2.5">
                 {funfacts.slice(1).map((funfact) => (
                   <li key={funfact.id} className="text-black text-xs sm:text-sm leading-relaxed pl-5 sm:pl-6 relative">
                     <img src="/bulb3.svg" alt="bulb3" className="absolute left-0 top-1 w-3 h-3 sm:w-4 sm:h-4" />
                     {funfact.description}
                   </li>
                 ))}
               </ul>
             )}
           </>
         ) : (
           <>
             {/* Fallback content if no funfacts available */}
             <ul className="space-y-2 sm:space-y-2.5">
               {[
                 'Expand your expertise through our exclusive and wide-ranging quiz topics.',
                 'A widest and coolest collection of fun and engaging quizzes entertains you.',
                 'THE completion of each quiz contest boosts your knowledge and self-confidence.',
                 'A large number of players from across the globe rely on us to have an immersive quiz experience.',
                 'Major categories you discover here include business, finance, sports, knowledge and more.',
               ].map((feature, index) => (
                 <li key={index} className="text-black text-xs sm:text-sm leading-relaxed pl-5 sm:pl-6 relative">
                   <img src="/bulb3.svg" alt="bulb3" className="absolute left-0 top-1 w-3 h-3 sm:w-4 sm:h-4" />
                   {feature}
                 </li>
               ))}
             </ul>
           </>
         )}
       </div>

      {/* Second Advertisement - Between content sections for engagement */}
      {/* <div className="bg-[#2C2159] rounded-lg p-4 mb-5 shadow-lg">
        <p className="text-center text-white text-xs mb-2 font-medium">ADVERTISEMENT</p>
        <div className="w-full overflow-hidden">
          <AdsenseAd adSlot="8153775072" adFormat="auto" />
        </div>
      </div> */}


      {/* Discover Fun Quizzes Section */}
      <div className="bg-[#FFF6D9] rounded-xl p-5 mb-1 shadow-lg border-[#BFBAA7] border-3">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Discover Fun Quizzes</h3>
        <ul className="space-y-2.5">
          {[
            'Expand your expertise through our exclusive and wide-ranging quiz topics.',
            'A widest and coolest collection of fun and engaging quizzes entertains you.',
            'THE completion of each quiz contest boosts your knowledge and self-confidence.',
            'A large number of players from across the globe rely on us to have an immersive quiz experience.',
            'Major categories you discover here include business, finance, sports, knowledge and more.',
            'Challenge players worldwide and enhance your abilities.',
          ].map((feature, index) => (
            <li key={index} className="text-gray-800 text-sm leading-relaxed pl-5 relative">
              <img src="/star.svg" alt="checkmark" className="absolute left-0 top-1 w-4 h-4" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      
    </div>
    {/* Footer */}
      <Footer />
    </>
  );
}
