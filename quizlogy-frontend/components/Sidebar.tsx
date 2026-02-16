'use client';

import { useRouter } from 'next/navigation';
import { authApi, User } from '@/lib/api';
import { useEffect, useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onReportIssueClick?: () => void;
}

export const Sidebar = ({ isOpen, onClose, onReportIssueClick }: SidebarProps) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Prevent body scroll when sidebar is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const checkAuth = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Only fetch from API if we have a stored user (to refresh coins)
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (err: any) {
          // If API call fails (401), user is no longer authenticated
          if (err?.response?.status === 401) {
            setUser(null);
            localStorage.removeItem('user');
          }
        }
      } else {
        // No stored user, don't make API call for guests
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (path: string) => {
    router.push(path);
    onClose(); // Close sidebar when navigating
  };

  const handleSignIn = () => {
    router.push('/login');
    onClose();
  };

  const handleProfileClick = () => {
    if (user) {
      router.push('/profile');
      onClose();
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 h-full w-full sm:w-80 bg-[#0D0009] z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-y-full'
        }`}
        style={{
          boxShadow: '0px 0px 2px 0px #FFF6D9'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header with Close Button */}
          <div className="flex justify-end p-4">
            <button
              onClick={onClose}
              className="text-[#FFF6D9] hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {/* User Profile Section */}
          <div className="px-6 pb-6 border-b border-[#FFF6D9]/20">
            <div className="flex items-center gap-4">
              {/* Profile Avatar with Progress Circle */}
              <div className="relative">
                {/* Progress Circle SVG */}
                {user && (() => {
                  // Calculate profile completion percentage
                  const profile = user.profile;
                  const fields = [
                    profile?.mobileNo,
                    profile?.whatsappNo,
                    profile?.address,
                    profile?.city,
                    profile?.country,
                    profile?.postalCode,
                  ];
                  const filledFields = fields.filter(f => f && f.trim() !== '').length;
                  const completionPercentage = (filledFields / 6) * 100;
                  const circumference = 2 * Math.PI * 28; // radius = 28
                  const offset = circumference - (completionPercentage / 100) * circumference;
                  
                  return (
                    <svg className="absolute inset-0 w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                      {/* Background circle */}
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="rgba(255, 246, 217, 0.2)"
                        strokeWidth="4"
                      />
                      {/* Progress circle */}
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke={completionPercentage === 100 ? "#10b981" : completionPercentage >= 50 ? "#fbbf24" : "#ef4444"}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="transition-all duration-500"
                      />
                    </svg>
                  );
                })()}
                
              <div
                onClick={user ? handleProfileClick : undefined}
                  className={`relative w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center shadow-lg ${user ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
              >
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : user?.name ? (
                  <span className="text-white text-2xl font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                    <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1">
                <h3 className="text-[#FFF6D9] text-xl font-bold">
                  {user?.name || 'Guest User'}
                </h3>
                <p className="text-[#FFF6D9]/70 text-sm mb-2">Play Quiz Earn Coins</p>
                {user && user.profile && (() => {
                  const profile = user.profile;
                  const fields = [
                    profile?.mobileNo,
                    profile?.whatsappNo,
                    profile?.address,
                    profile?.city,
                    profile?.country,
                    profile?.postalCode,
                  ];
                  const filledFields = fields.filter(f => f && f.trim() !== '').length;
                  const completionPercentage = (filledFields / 6) * 100;
                  
                  if (completionPercentage < 100) {
                    return (
                      <p className="text-yellow-400 text-xs font-medium">
                        Complete the profile details
                      </p>
                    );
                  }
                  return null;
                })()}
                {!user && (
                  <button
                    onClick={handleSignIn}
                    className="bg-yellow-400 text-[#0D0009] font-bold px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors text-sm"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-0 px-4">
              {/* Quiz Rules */}
              <button
                onClick={() => handleMenuClick('/quiz-rules')}
                className="w-full flex items-center gap-4 px-4 py-3 text-[#FFF6D9] hover:bg-[#0D0009]/80 rounded-lg transition-colors text-left"
              >
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">Quiz Rules</span>
              </button>

              {/* Coin History */}
              <button
                onClick={() => handleMenuClick('/coin-history')}
                className="w-full flex items-center gap-4 px-4 py-3 text-[#FFF6D9] hover:bg-[#0D0009]/80 rounded-lg transition-colors text-left"
              >
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Coin History</span>
              </button>

              {/* About Us */}
              <button
                onClick={() => handleMenuClick('/about-us')}
                className="w-full flex items-center gap-4 px-4 py-3 text-[#FFF6D9] hover:bg-[#0D0009]/80 rounded-lg transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">i</span>
                </div>
                <span className="font-medium">About Us</span>
              </button>

              {/* Contact Us */}
              <button
                onClick={() => handleMenuClick('/contact-us')}
                className="w-full flex items-center gap-4 px-4 py-3 text-[#FFF6D9] hover:bg-[#0D0009]/80 rounded-lg transition-colors text-left"
              >
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Contact Us</span>
              </button>

              {/* Report An Issue */}
              <button
                onClick={() => {
                  onClose();
                  if (onReportIssueClick) {
                    onReportIssueClick();
                  }
                }}
                className="w-full flex items-center gap-4 px-4 py-3 text-[#FFF6D9] hover:bg-[#0D0009]/80 rounded-lg transition-colors text-left"
              >
                <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16v2h2v-2h-2zm0-6v4h2v-4h-2z"/>
                </svg>
                <span className="font-medium">Report An Issue</span>
              </button>
            </div>
          </div>

          {/* Connect With Us Section */}
          <div className="px-6 py-6 border-t border-[#FFF6D9]/20">
            <h4 className="text-[#FFF6D9]/70 font-semibold mb-4">Connect With Us</h4>
            <div className="flex gap-3">
              {/* Facebook */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors"
              >
                <span className="text-white font-bold text-sm">f</span>
              </a>

              {/* Instagram */}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>

              {/* X (Twitter) */}
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors"
              >
                <span className="text-white font-bold text-sm">X</span>
              </a>

              {/* Pinterest */}
              <a
                href="https://pinterest.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors"
              >
                <span className="text-white font-bold text-sm">P</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

