'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdsenseAd from '@/components/AdsenseAd';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { authApi } from '@/lib/api';

/* =========================
   ORIGINAL LOGIN COMPONENT
   (ONLY NAME CHANGED)
   ========================= */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await authApi.getCurrentUser();
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));

          const returnUrl = searchParams.get('returnUrl');
          if (returnUrl) {
            router.push(decodeURIComponent(returnUrl));
          } else {
            router.push('/profile');
          }
        }
      } catch (err) {
        // Not logged in, stay on login page
      }
    };

    checkAuth();
  }, [router, searchParams]);

  const handleGoogleSignIn = () => {
    const returnUrl = searchParams.get('returnUrl');
    if (returnUrl) {
      localStorage.setItem('loginReturnUrl', decodeURIComponent(returnUrl));
    }
    authApi.googleLogin();
  };

  const handlePhoneSignIn = () => {
    console.log('Sign in with Phone Number');
  };

  return (
    <>
      <SEOHead 
        title="Sign In to Quizwala - Play Quizzes & Win Prizes"
        description="Sign in to Quizwala with Google to start playing quizzes, earning coins, and winning exciting prizes. Join thousands of players and test your knowledge today!"
        keywords="quiz login, sign in quiz, quiz account, google sign in, quiz app login"
      />
      <DashboardNav />

      <div className="min-h-fit bg-[#0D0009] p-5" style={{
        // boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-md mx-auto">
          {/* Back Button */}
          {/* <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 flex items-center gap-2 text-[#FFF6D9] hover:text-yellow-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back</span>
          </button> */}

          {/* Sign in Section */}
          <div className="bg-[#FFF6D9] rounded-xl p-6 mb-5 border border-[#BFBAA7]" style={{
            boxShadow: '0px 0px 2px 0px #FFF6D9'
          }}>
            <h1 className="text-[#0D0009] text-2xl font-bold text-center mb-2">
              Sign in to Quizwala
            </h1>
            <p className="text-[#0D0009]/70 text-sm text-center mb-6">
              Grow your knowledge with Quizwala's quizzes
            </p>

            <button
              onClick={handleGoogleSignIn}
              className="w-full bg-white rounded-xl py-3 px-4 flex items-center justify-center gap-3 mb-4 hover:bg-gray-100 transition-colors shadow-md border border-[#BFBAA7]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-[#0D0009] font-semibold">Sign in with Google</span>
            </button>

            {/* <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/20"></div>
              <span className="text-white/70 text-sm">OR</span>
              <div className="flex-1 h-px bg-white/20"></div>
            </div> */}

            {/* <button
              onClick={handlePhoneSignIn}
              className="w-full bg-transparent border-2 border-white/30 rounded-xl py-3 px-4 text-white font-semibold hover:border-white/50 hover:bg-white/5 transition-colors"
            >
              Sign in with Phone Number
            </button> */}
          </div>

          
        </div>
      </div>
      <p className="text-center border-t border-[#FFF6D9]/20 text-[#FFF6D9] text-xs mt-2 mb-2 font-medium">ADVERTISEMENT</p>
      <div className="w-full overflow-hidden border-b border-[#FFF6D9]/20">
        <AdsenseAd adSlot="8153775072" adFormat="auto" />
      </div>
      <Footer />
    </>
  );
}

/* =========================
   REQUIRED SUSPENSE WRAPPER
   ========================= */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-[#FFF6D9] p-5 bg-[#0D0009] min-h-screen">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
