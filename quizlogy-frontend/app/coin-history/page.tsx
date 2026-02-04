'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { authApi, User, coinsApi, CoinHistory } from '@/lib/api';
import AdsenseAd from '@/components/AdsenseAd';

export default function CoinHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [coinHistory, setCoinHistory] = useState<CoinHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchUserData();
    fetchCoinHistory();
    
    // Listen for coins updated event to refresh data
    const handleCoinsUpdate = () => {
      fetchUserData();
      fetchCoinHistory();
    };
    
    window.addEventListener('coinsUpdated', handleCoinsUpdate);
    
    return () => {
      window.removeEventListener('coinsUpdated', handleCoinsUpdate);
    };
  }, []);

  const fetchUserData = async () => {
    try {
      // Always fetch fresh user data to get updated coins
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      // Trigger coins update event for navbar
      window.dispatchEvent(new Event('coinsUpdated'));
    } catch (err) {
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoinHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await coinsApi.getHistory({ limit: 50 });
      setCoinHistory(response.data);
    } catch (err) {
      console.error('Error fetching coin history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <>
      <SEOHead 
        title="Coin History - Track Your Quizwala Coins & Transactions"
        description="View your complete coin transaction history on Quizwala. Track all your earnings, spending, and coin rewards from quizzes and contests in one place."
        keywords="coin history, quiz coins, transaction history, coin balance, quiz rewards, coin tracking"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#0D0009] p-5" style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="text-[#FFF6D9] hover:text-gray-300 transition-colors mb-4"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-[#FFF6D9] text-2xl font-bold">Coin History</h1>
          </div>

          {/* Main Content Area */}
          {loading ? (
            <div className="text-[#FFF6D9] text-center py-12">Loading...</div>
          ) : user ? (
            <div className="space-y-3 mb-6">
              {loadingHistory ? (
                <div className="text-center text-[#FFF6D9]/50 py-8">Loading...</div>
              ) : coinHistory.length === 0 ? (
                <div className="bg-[#FFF6D9] rounded-xl p-8 text-center border border-[#BFBAA7]">
                  <p className="text-[#0D0009] text-lg font-semibold">No transaction history available yet</p>
                  <p className="text-[#0D0009]/70 text-sm mt-2">Start playing quizzes to earn coins!</p>
                </div>
              ) : (
                coinHistory.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="bg-[#FFF6D9] rounded-xl p-4 flex items-start gap-4 border border-[#BFBAA7]"
                  >
                    {/* Circular Gold Coin Icon on Left */}
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        transaction.amount > 0 ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        <img src="/coin.svg" alt="Coin" className="w-8 h-8" />
                      </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1">
                      {/* Description */}
                      <p className="text-[#0D0009] text-base font-semibold mb-1">
                        {transaction.description || 'Transaction'}
                      </p>

                      {/* Date */}
                      <p className="text-[#0D0009]/70 text-xs mb-2">
                        {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      {/* Transaction ID */}
                      <p className="text-[#0D0009]/50 text-xs mb-2">
                        ID: {transaction.id.slice(0, 13)}...
                      </p>

                      {/* Amount */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <img src="/coin.svg" alt="Coins" className="w-4 h-4" />
                        <span className={`font-bold text-base ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="bg-[#FFF6D9] rounded-xl p-8 text-center border border-[#BFBAA7]">
              <p className="text-[#0D0009] text-lg font-semibold mb-4">Please sign in to view your coin history</p>
              <button
                onClick={() => router.push('/login')}
                className="bg-yellow-400 text-[#0D0009] font-bold px-6 py-3 rounded-lg hover:bg-yellow-500 transition-colors"
              >
                Sign In
              </button>
            </div>
          )}

          {/* Advertisement Section */}
          <div className="mt-6">
            <p className="text-center border-t border-[#564C53] text-white text-xs pt-2 mb-2 font-medium">ADVERTISEMENT</p>
            <div className="w-full overflow-hidden border-b border-[#564C53]">
              <AdsenseAd adSlot="8153775072" adFormat="auto" />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

