'use client';

import { useEffect, useState, useRef } from 'react';
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const hasFetched = useRef(false);

  useEffect(() => {
    // Prevent duplicate fetch on mount
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadingHistory(true);

        // Fetch user data and coin history in parallel
        const [userData, historyResponse] = await Promise.all([
          authApi.getCurrentUser().catch(() => null),
          coinsApi.getHistory({ limit: 100 }).catch(() => ({ data: [] }))
        ]);

        if (userData) {
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }

        setCoinHistory(historyResponse.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
        setLoadingHistory(false);
      }
    };

    fetchData();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatTime = (seconds: number | null | undefined): string => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getTransactionIcon = (transaction: CoinHistory): { bg: string; icon: string } => {
    if (transaction.status === 'PENDING') {
      return { bg: 'bg-[#FFD602]', icon: '⏳' };
    }
    if (transaction.contestName || transaction.description?.includes('Quiz completed') || transaction.description?.includes('Coins awarded')) {
      return { bg: 'bg-[#9272FF]', icon: '🎮' };
    }
    if (transaction.description?.includes('Joined contest')) {
      return { bg: 'bg-[#FF6B6B]', icon: '🎟️' };
    }
    if (transaction.description?.includes('lifeline')) {
      return { bg: 'bg-[#4ECDC4]', icon: '💡' };
    }
    if (transaction.description?.includes('Spin')) {
      return { bg: 'bg-[#FFD602]', icon: '🎰' };
    }
    if (transaction.type === 'EARNED') {
      return { bg: 'bg-green-500', icon: '💰' };
    }
    if (transaction.type === 'SPENT') {
      return { bg: 'bg-red-500', icon: '💸' };
    }
    return { bg: 'bg-gray-500', icon: '🪙' };
  };

  // Filter transactions based on active tab
  const filteredHistory = coinHistory.filter(transaction => {
    if (activeTab === 'pending') return transaction.status === 'PENDING';
    if (activeTab === 'completed') return transaction.status === 'COMPLETED';
    return true;
  });

  // Calculate pending and completed counts
  const pendingCount = coinHistory.filter(t => t.status === 'PENDING').length;
  const pendingCoins = coinHistory.filter(t => t.status === 'PENDING').reduce((sum, t) => sum + t.amount, 0);

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
            {user && (
              <div className="flex items-center gap-2 mt-2">
                <img src="/coin.svg" alt="Coins" className="w-5 h-5" />
                <span className="text-[#FFD602] font-bold text-lg">{user.coins?.toLocaleString() || 0} Coins</span>
              </div>
            )}
          </div>

          {/* Pending Coins Banner */}
          {pendingCount > 0 && (
            <div className="bg-gradient-to-r from-[#FFD602]/20 to-[#FFD602]/10 rounded-xl p-4 mb-4 border border-[#FFD602]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FFD602] rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-lg">⏳</span>
                </div>
                <div className="flex-1">
                  <p className="text-[#FFD602] font-bold text-sm">Pending Rewards</p>
                  <p className="text-[#FFF6D9]/70 text-xs">
                    You have {pendingCount} contest{pendingCount > 1 ? 's' : ''} awaiting results
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#FFD602] font-bold text-lg flex items-center gap-1">
                    <img src="/coin.svg" alt="" className="w-4 h-4" />
                    +{pendingCoins}
                  </p>
                  <p className="text-[#FFF6D9]/50 text-xs">Expected</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab Filters */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-[#FFD602] text-[#0D0009]'
                  : 'bg-[#1a0f15] text-[#FFF6D9]/70 border border-[#564C53]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'pending'
                  ? 'bg-[#FFD602] text-[#0D0009]'
                  : 'bg-[#1a0f15] text-[#FFF6D9]/70 border border-[#564C53]'
              }`}
            >
              Pending
              {pendingCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === 'pending' ? 'bg-[#0D0009]/20' : 'bg-[#FFD602]/20 text-[#FFD602]'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'completed'
                  ? 'bg-[#FFD602] text-[#0D0009]'
                  : 'bg-[#1a0f15] text-[#FFF6D9]/70 border border-[#564C53]'
              }`}
            >
              Completed
            </button>
          </div>

          {/* Main Content Area */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-3 border-[#FFD602] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-[#FFF6D9]/70">Loading your history...</p>
            </div>
          ) : user ? (
            <div className="space-y-3 mb-6">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-10 h-10 border-3 border-[#FFD602] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-[#FFF6D9]/70">Loading transactions...</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="bg-[#1a0f15] rounded-xl p-8 text-center border border-[#564C53]">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[#FFD602]/20 rounded-full flex items-center justify-center">
                    <span className="text-3xl">{activeTab === 'pending' ? '⏳' : '🪙'}</span>
                  </div>
                  <p className="text-[#FFF6D9] text-lg font-semibold">
                    {activeTab === 'pending' ? 'No pending results' : activeTab === 'completed' ? 'No completed transactions' : 'No transactions yet'}
                  </p>
                  <p className="text-[#FFF6D9]/70 text-sm mt-2">
                    {activeTab === 'pending'
                      ? 'Play contests to see pending rewards here!'
                      : 'Start playing quizzes to earn coins!'}
                  </p>
                  {activeTab === 'all' && (
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="mt-4 bg-[#FFD602] text-[#0D0009] font-bold px-6 py-2 rounded-lg hover:bg-[#FFE033] transition-colors"
                    >
                      Play Quiz
                    </button>
                  )}
                </div>
              ) : (
                filteredHistory.map((transaction) => {
                  const isExpanded = expandedItems.has(transaction.id);
                  const { bg, icon } = getTransactionIcon(transaction);
                  const isPending = transaction.status === 'PENDING';
                  const hasContestDetails = transaction.contestName ||
                    transaction.correctAnswers !== null ||
                    transaction.wrongAnswers !== null;

                  return (
                    <div
                      key={transaction.id}
                      className={`rounded-xl overflow-hidden border transition-all duration-300 ${
                        isPending
                          ? 'bg-gradient-to-r from-[#1a0f15] to-[#2a1f25] border-[#FFD602]/30'
                          : 'bg-[#1a0f15] border-[#564C53]'
                      }`}
                    >
                      {/* Pending Badge */}
                      {isPending && (
                        <div className="bg-[#FFD602]/20 px-4 py-2 flex items-center gap-2">
                          <span className="animate-pulse">⏳</span>
                          <span className="text-[#FFD602] text-xs font-medium">
                            Awaiting Result Announcement
                          </span>
                        </div>
                      )}

                      {/* Main Row */}
                      <div
                        className={`p-4 flex items-start gap-4 ${hasContestDetails ? 'cursor-pointer hover:bg-[#1a0f15]/80' : ''}`}
                        onClick={() => hasContestDetails && toggleExpand(transaction.id)}
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bg} ${isPending ? 'animate-pulse' : ''}`}>
                            <span className="text-xl">{icon}</span>
                          </div>
                        </div>

                        {/* Transaction Details */}
                        <div className="flex-1 min-w-0">
                          {/* Description */}
                          <p className="text-[#FFF6D9] text-base font-semibold mb-1 truncate">
                            {transaction.contestName || transaction.description || 'Transaction'}
                          </p>

                          {/* Date */}
                          <p className="text-[#FFF6D9]/50 text-xs">
                            {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>

                          {/* Quick Stats for Contest Results */}
                          {hasContestDetails && !isExpanded && (
                            <div className="flex items-center gap-3 mt-2">
                              {transaction.correctAnswers !== null && (
                                <span className="text-green-400 text-xs flex items-center gap-1">
                                  <span>✓</span> {transaction.correctAnswers}
                                </span>
                              )}
                              {transaction.wrongAnswers !== null && (
                                <span className="text-red-400 text-xs flex items-center gap-1">
                                  <span>✗</span> {transaction.wrongAnswers}
                                </span>
                              )}
                              <span className="text-[#FFF6D9]/40 text-xs">Tap for details</span>
                            </div>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="flex flex-col items-end flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            <img src="/coin.svg" alt="Coins" className="w-4 h-4" />
                            <span className={`font-bold text-base ${
                              isPending
                                ? 'text-[#FFD602]'
                                : transaction.amount > 0
                                  ? 'text-green-400'
                                  : 'text-red-400'
                            }`}>
                              {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                            </span>
                          </div>
                          {isPending && (
                            <span className="text-[#FFD602]/70 text-xs mt-1">pending</span>
                          )}
                          {hasContestDetails && !isPending && (
                            <svg
                              className={`w-4 h-4 text-[#FFF6D9]/50 mt-1 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {hasContestDetails && isExpanded && (
                        <div className="px-4 pb-4 border-t border-[#564C53]/50">
                          <div className="pt-3 grid grid-cols-2 gap-3">
                            {/* Correct Answers */}
                            <div className="bg-[#0D0009] rounded-lg p-3 text-center">
                              <p className="text-green-400 text-2xl font-bold">
                                {transaction.correctAnswers ?? 0}
                              </p>
                              <p className="text-[#FFF6D9]/60 text-xs mt-1">Correct</p>
                            </div>

                            {/* Wrong Answers */}
                            <div className="bg-[#0D0009] rounded-lg p-3 text-center">
                              <p className="text-red-400 text-2xl font-bold">
                                {transaction.wrongAnswers ?? 0}
                              </p>
                              <p className="text-[#FFF6D9]/60 text-xs mt-1">Wrong</p>
                            </div>

                            {/* Total Questions */}
                            <div className="bg-[#0D0009] rounded-lg p-3 text-center">
                              <p className="text-[#4ECDC4] text-2xl font-bold">
                                {transaction.totalQuestions ?? '-'}
                              </p>
                              <p className="text-[#FFF6D9]/60 text-xs mt-1">Questions</p>
                            </div>

                            {/* Time Taken */}
                            <div className="bg-[#0D0009] rounded-lg p-3 text-center">
                              <p className="text-[#9272FF] text-2xl font-bold">
                                {formatTime(transaction.timeTaken)}
                              </p>
                              <p className="text-[#FFF6D9]/60 text-xs mt-1">Time</p>
                            </div>
                          </div>

                          {/* Coins Breakdown */}
                          <div className="mt-3 bg-[#0D0009] rounded-lg p-3">
                            <p className="text-[#FFF6D9]/60 text-xs mb-2">Coins Breakdown</p>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-green-400">+{(transaction.correctAnswers ?? 0) * 10} (correct × 10)</span>
                              <span className="text-red-400">-{(transaction.wrongAnswers ?? 0) * 5} (wrong × 5)</span>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#564C53]/50">
                              <span className="text-[#FFF6D9] font-medium">
                                {isPending ? 'Will Receive' : 'Total Earned'}
                              </span>
                              <span className={`font-bold flex items-center gap-1 ${isPending ? 'text-[#FFD602]' : 'text-[#FFD602]'}`}>
                                <img src="/coin.svg" alt="" className="w-4 h-4" />
                                {transaction.winningAmount ?? transaction.amount}
                                {isPending && <span className="text-xs font-normal">(pending)</span>}
                              </span>
                            </div>
                          </div>

                          {/* Pending Message */}
                          {isPending && (
                            <div className="mt-3 bg-[#FFD602]/10 rounded-lg p-3 text-center">
                              <p className="text-[#FFD602] text-sm">
                                Coins will be credited when contest results are announced
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="bg-[#1a0f15] rounded-xl p-8 text-center border border-[#564C53]">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#FFD602]/20 rounded-full flex items-center justify-center">
                <span className="text-3xl">🔒</span>
              </div>
              <p className="text-[#FFF6D9] text-lg font-semibold mb-4">Please sign in to view your coin history</p>
              <button
                onClick={() => router.push('/login')}
                className="bg-[#FFD602] text-[#0D0009] font-bold px-6 py-3 rounded-lg hover:bg-[#FFE033] transition-colors"
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
