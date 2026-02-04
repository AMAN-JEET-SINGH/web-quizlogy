'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, User } from '@/lib/api';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

export default function LoginSuccessPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      // Always fetch fresh user data to get updated coins
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      
      // Store fresh user data in localStorage to keep coins in sync
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Trigger coins update event for navbar
      window.dispatchEvent(new Event('coinsUpdated'));
      
      // Redirect immediately or after very brief delay (500ms max)
      const returnUrl = localStorage.getItem('loginReturnUrl');
      const redirectPath = returnUrl || '/profile';
      localStorage.removeItem('loginReturnUrl');
      
      // Use replace instead of push to avoid showing back button
      setTimeout(() => {
        router.replace(redirectPath);
      }, 500);
    } catch (err: any) {
      console.error('Error fetching user:', err);
      setError('Failed to get user information. Please try logging in again.');
      setTimeout(() => {
        router.replace('/login');
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead 
        title="Login Successful - Welcome to Quizwala"
        description="Successfully logged in to Quizwala! Start playing quizzes, earning coins, and winning prizes. Your quiz journey begins now!"
        keywords="login success, quiz login, welcome quizwala, quiz account"
      />
      <div className="min-h-screen bg-[#0D0009] flex items-center justify-center p-5">
        <div className="max-w-md w-full">
          {loading ? (
            <div className="text-center">
              <div className="w-12 h-12 border-3 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-[#FFF6D9] text-sm">Loading...</p>
            </div>
          ) : error ? (
            <div className="bg-[#FFF6D9] rounded-xl p-6 text-center border border-red-500/50">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-[#0D0009] text-sm font-medium">{error}</p>
            </div>
          ) : user ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-[#FFF6D9] text-sm">Redirecting...</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}


