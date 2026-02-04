'use client';

import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import AdsenseAd from '@/components/AdsenseAd';

export default function QuizRulesPage() {
  const router = useRouter();
  
  return (
    <>
      <SEOHead 
        title="Quiz Rules - How to Play Quizzes on Quizwala"
        description="Learn the rules and guidelines for playing quizzes on Quizwala. Understand scoring, time limits, coin rewards, and how to maximize your quiz performance."
        keywords="quiz rules, how to play quiz, quiz guidelines, quiz instructions, quiz scoring"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#0D0009]" style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-4xl mx-auto p-5">
          {/* Contest Rules Content */}
          <button
              onClick={() => router.push('/dashboard')}
              className="top-4 left-7 text-lg font-medium text-[#FFF6D9] hover:text-gray-600 transition-colors z-10 mb-4"
            >
              Back
            </button>
          <div className="bg-[#FFF6D9] rounded-xl p-6 mb-5 border border-[#BFBAA7]" style={{
            boxShadow: '0px 0px 2px 0px #FFF6D9'
          }}>
            {/* Back Button */}
            
            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-[#0D0009] text-4xl font-bold mb-2">CONTEST RULES!</h1>
              <div className="h-1 bg-yellow-400 mx-auto" style={{ width: '200px' }}></div>
            </div>
            
            {/* Rules Content */}
            <div className="space-y-4 text-[#0D0009]">
              <ul className="space-y-3 list-none">
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>Winner will be declared based on scores. In case of a tie, the earliest completion time will be considered.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>Winner declaration time is fixed. Check the contest details for the exact time.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>You have 60 seconds to answer 20 questions.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>Each question has 4 options with only one correct answer.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>+25 points for right answer, -10 points for wrong answer.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-400 mr-2">•</span>
                  <span>You can use each lifeline once per contest. Lifelines can be activated either by spending coins or watching an advertisement.</span>
                </li>
              </ul>

              {/* Lifelines Section */}
              <div className="mt-6 pt-6 border-t border-[#0D0009]/20">
                <h2 className="text-yellow-400 text-xl font-bold mb-4">Lifelines:</h2>
                <ul className="space-y-3 list-none">
                  <li className="flex items-start">
                    <span className="text-yellow-400 mr-2 font-bold">50:50</span>
                    <span> - Eliminates two incorrect answers, leaving you with two options.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-400 mr-2 font-bold">Freezer Time</span>
                    <span> - Pauses the timer for 30 seconds, giving you extra time to think.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-400 mr-2 font-bold">Audience Poll</span>
                    <span> - Helps you choose the right answer using smart audience intelligence.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-400 mr-2 font-bold">Flip Question</span>
                    <span> - Replaces the current question with a new one.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Advertisement Section - Optimally placed after rules content */}
          <div className="bg-[#0D0009] rounded-lg p-4 mb-5 border border-[#FFF6D9]/20" style={{
            boxShadow: '0px 0px 2px 0px #FFF6D9'
          }}>
            <p className="text-center text-[#FFF6D9] text-xs mb-2 font-medium">ADVERTISEMENT</p>
            <div className="w-full overflow-hidden">
              <AdsenseAd adSlot="8153775072" adFormat="auto" />
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}

