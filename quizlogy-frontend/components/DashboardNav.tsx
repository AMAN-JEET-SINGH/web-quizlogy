'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, User } from '@/lib/api';
import { Sidebar } from './Sidebar';
import { ReportIssueModal } from './ReportIssueModal';

export const DashboardNav = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportIssueModalOpen, setReportIssueModalOpen] = useState(false);
  const [guestCoins, setGuestCoins] = useState<number>(0);

  useEffect(() => {
    checkAuth();
    updateGuestCoins();
    
    // Listen for storage changes (for guest coins and user updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'guestCoins') {
        updateGuestCoins();
      } else if (e.key === 'user') {
        // User data was updated, refresh
        checkAuth();
      }
    };
    
    // Listen for custom events (triggered when coins are updated)
    const handleCoinsUpdate = () => {
      // Update immediately from localStorage first (instant update)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (e) {
          console.error('Error parsing user:', e);
        }
      }
      updateGuestCoins();
      
      // Then fetch fresh data from API in background (for sync)
      (async () => {
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const userData = await authApi.getCurrentUser();
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (err) {
          // If API call fails, keep the localStorage value
        }
      })();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('coinsUpdated', handleCoinsUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('coinsUpdated', handleCoinsUpdate);
    };
  }, []);

  const updateGuestCoins = () => {
    const coins = parseInt(localStorage.getItem('guestCoins') || '0');
    setGuestCoins(coins);
  };

  const checkAuth = async () => {
    try {
      // Try to get from localStorage first for immediate display
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Always fetch fresh data from API to get updated coins
        // This ensures coins are always in sync with the database
        try {
          const userData = await authApi.getCurrentUser();
          // Only update if coins changed or if it's a fresh fetch
          if (userData.coins !== parsedUser.coins || !parsedUser.coins) {
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            // Coins are the same, but update other fields that might have changed
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (err) {
          // Session expired, but keep stored user for now
          // Just update from localStorage
          setUser(parsedUser);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      // User not authenticated - this is fine for guests
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        onReportIssueClick={() => setReportIssueModalOpen(true)}
      />
      <ReportIssueModal 
        isOpen={reportIssueModalOpen} 
        onClose={() => setReportIssueModalOpen(false)}
      />
      <div className="w-full bg-[#0D0009] border-b border-[#564C53] relative">
        {/* Bell GIF in corner */}
        <div className="flex items-center justify-between px-4 py-3 w-full">
          {/* Left Section: Hamburger Menu + Logo + Quizwala */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Hamburger Menu Icon */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col gap-1.5 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
            >
              <img src="/burger.svg" alt="Hamburger Menu" className="w-6 h-6" />
            </button>

            {/* Logo */}
            <div className="w-12 h-12 border-white flex items-center justify-center -hidden">
              <button onClick={() => {
                window.location.href = '/dashboard';
              }}>
                <img 
                  src="/logo.svg" 
                  alt="Quizwala Logo" 
                  className="w-11 h-11 object-contain"
                />
              </button>
            </div>

            {/* Quizwala Text */}
            <button 
              onClick={() => {
                window.location.href = '/dashboard';
              }}
              className="flex-shrink-0"
            >
              <h1 className="text-white text-xl font-bold whitespace-nowrap">Quizwala</h1>
            </button>
          </div>

          {/* Right Section: LOGIN Button or Coins Balance + View Profile */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            {!loading && (
              <>
                {user ? (
                  <>
                    {/* Coin balance - click goes to login (re-auth) */}
                    <button
                      onClick={() => router.push('/login')}
                      className="flex items-center gap-2 bg-[#FFF6D9] px-3 sm:px-4 py-2 rounded-lg flex-shrink-0 min-w-fit hover:bg-[#FFF6D9]/90 transition-colors cursor-pointer"
                    >
                      <img src="/coin.svg" alt="Coins Icon" className="w-5 h-5 flex-shrink-0" />
                      <span className="text-black font-bold text-sm whitespace-nowrap">
                        {user.coins?.toLocaleString() || 0}
                      </span>
                    </button>
                    {/* View Profile Button - Show when logged in */}
                    <button
                      onClick={() => router.push('/profile')}
                      className="bg-[#FFF6D9] text-black font-bold px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                    >
                      View Profile
                    </button>
                  </>
                ) : (
                  // Show guest coins or login button
                  guestCoins > 0 ? (
                    <button
                      onClick={() => router.push('/login')}
                      className="flex items-center gap-2 bg-[#FFF6D9] px-3 sm:px-4 py-2 rounded-lg flex-shrink-0 min-w-fit hover:bg-[#FFF6D9]/90 transition-colors cursor-pointer"
                    >
                      <img src="/coin.svg" alt="Coins Icon" className="w-5 h-5 flex-shrink-0" />
                      <span className="text-black font-bold text-sm whitespace-nowrap">
                        {guestCoins.toLocaleString()} <span className="hidden sm:inline">(Guest)</span>
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/login')}
                      className="bg-[#FFF6D9] text-black font-bold px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm whitespace-nowrap flex-shrink-0"
                    >
                      LOGIN
                    </button>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
