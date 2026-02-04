"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface QuizResultCardProps {
  correctCount: number;
  coinsAwarded: number;
  onPlayAgain: () => void;
}

export const QuizResultCard = ({ correctCount, coinsAwarded, onPlayAgain }: QuizResultCardProps) => {
  const router = useRouter();
  const isPerfect = correctCount === 2;
  const gifRef = useRef<HTMLImageElement>(null);

  // Force GIF to loop by reloading it periodically
  useEffect(() => {
    if (isPerfect && gifRef.current) {
      const img = gifRef.current;
      const interval = setInterval(() => {
        // Reload the GIF to restart animation
        const currentSrc = img.src;
        // img.src = '';
        setTimeout(() => {
          img.src = currentSrc.split('?')[0] + '?t=' + Date.now();
        }, 0);
      }, 2000); // Reload every 2 seconds (adjust based on your GIF duration)

      return () => clearInterval(interval);
    }
  }, [isPerfect]);

  return (
    <div className="max-w-md mx-auto mt-0">
      <div className=" rounded-xl p-4 text-center">
        {isPerfect ? (
          <>
            <div className="w-40 h-40 flex items-center justify-center mx-auto mb-4">
              <img 
                ref={gifRef}
                src="/chestbox.gif" 
                alt="chestbox" 
                className="w-full h-full object-contain"
                style={{ 
                  display: 'block',
                  pointerEvents: 'none'
                }}
                loading="eager"
              />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
                You have earn <span className="text-yellow-400">{coinsAwarded} coins</span>
            </h2>
            <p className="text-white mb-4 font-light text-18">
              Challenge yourself with more quizzes and earn even more coins!
            </p>

            
            
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-2">
              Quiz Completed!
            </h2>
            <p className="text-whitemb-4 text-[#ffffff]">
              You answered {correctCount} out of 2 questions correctly.
            </p>
            {coinsAwarded > 0 && (
              <div className="rounded-lg p-4 mb-4">
                <p className="text-lg font-bold text-white">
                  You earned <span className="text-yellow-400">{coinsAwarded} coins</span>
                </p>
              </div>
            )}
          </>
        )}
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-[#FBD457] text-black py-5 rounded-xl font-bold text-25 mt-4 transition-transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
        >
          <span className="relative z-10">Play Now</span>
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
        </button>
      </div>
    </div>
  );
};











