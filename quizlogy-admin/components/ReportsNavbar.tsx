'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '@/lib/adminContext';
import './ReportsNavbar.css';

interface ReportsNavbarProps {
  children: React.ReactNode;
}

export default function ReportsNavbar({ children }: ReportsNavbarProps) {
  const { logout, adminData } = useAdmin();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('reports-dark-mode');
    if (saved === 'true') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    // Collapse sidebar by default on smaller screens
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    // Enable transitions only after the initial layout has settled
    // so the sidebar snaps to the correct state without animating
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLayoutReady(true);
      });
    });
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock page scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
    } else {
      const top = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      if (top) {
        window.scrollTo(0, parseInt(top) * -1);
      }
    }
    return () => {
      const top = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      if (top) {
        window.scrollTo(0, parseInt(top) * -1);
      }
    };
  }, [mobileSidebarOpen]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('reports-dark-mode', String(next));
  };

  const isActive = (path: string) => pathname === path;
  const closeMobileSidebar = () => setMobileSidebarOpen(false);
  const showLabels = sidebarOpen || mobileSidebarOpen;

  const getUserInitials = () => {
    if (!adminData?.username) return '?';
    return adminData.username.slice(0, 2).toUpperCase();
  };

  const getPageTitle = () => {
    if (pathname === '/reports/overview') return 'Overview';
    if (pathname === '/reports') return 'Revenue Reports';
    if (pathname === '/invoice') return 'Invoice';
    if (pathname === '/settings') return 'Settings';
    if (pathname === '/reports/users') return 'Users';
    if (pathname === '/reports/invoicing') return 'Invoicing';
    return 'Reports';
  };

  const isSuperAdmin = adminData?.isSuperAdmin ?? false;

  const navItems = [
    {
      href: '/reports/overview',
      label: 'Dashboard',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
      show: true,
    },
    {
      href: '/reports',
      label: 'Report',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      show: true,
    },
    {
      href: '/invoice',
      label: 'Invoicing',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      show: true,
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      show: true,
    },
    {
      href: '/reports/users',
      label: 'Users',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      show: isSuperAdmin,
    },
  ];

  return (
    <div className={`rs-layout ${!layoutReady ? 'rs-no-transition' : ''}`}>
      {/* Mobile Overlay */}
      <div
        className={`rs-overlay ${mobileSidebarOpen ? 'open' : ''}`}
        onClick={closeMobileSidebar}
      />

      {/* Sidebar */}
      <aside className={`rs-sidebar ${sidebarOpen ? '' : 'collapsed'} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        {/* Sidebar Logo */}
        <div className="rs-sidebar-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/QuizangoLogo.svg"
            alt="Quizango"
            className="rs-logo-img"
          />
        </div>

        {/* Navigation */}
        <nav className="rs-sidebar-nav">
          {navItems.filter(item => item.show).map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`rs-nav-item ${isActive(item.href) ? 'active' : ''}`}
              onClick={closeMobileSidebar}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="rs-nav-icon">{item.icon}</span>
              {showLabels && <span className="rs-nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="rs-sidebar-footer">
          <button
            className="rs-nav-item rs-dark-toggle-item"
            onClick={toggleDarkMode}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            <span className="rs-nav-icon">
              {darkMode ? (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </span>
            {showLabels && <span className="rs-nav-label">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
        </div>
      </aside>

      {/* Content Wrapper */}
      <div className={`rs-content-wrapper ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        {/* Top Bar */}
        <header className="rs-topbar">
          <div className="rs-topbar-left">
            {/* Desktop sidebar toggle */}
            <button
              className="rs-hamburger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="22" height="22">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Mobile sidebar toggle */}
            <button
              className="rs-hamburger-mobile"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              aria-label="Toggle mobile sidebar"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="22" height="22">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="rs-page-title">{getPageTitle()}</h1>
          </div>

          <div className="rs-topbar-right">
            {/* Profile Area */}
            <div className="rs-profile-area" ref={profileRef}>
              <button
                className="rs-profile-trigger"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <span className="rs-profile-initials">{getUserInitials()}</span>
                <span className="rs-profile-avatar">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <span className="rs-profile-name">{adminData?.username || 'Admin'}</span>
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div className="rs-profile-dropdown">
                  <div className="rs-profile-dropdown-header">
                    <div className="rs-profile-dropdown-avatar">{getUserInitials()}</div>
                    <div>
                      <div className="rs-profile-dropdown-name">{adminData?.username}</div>
                      <div className="rs-profile-dropdown-role">{isSuperAdmin ? 'Super Admin' : 'Admin'}</div>
                    </div>
                  </div>
                  <div className="rs-profile-dropdown-divider" />
                  <button className="rs-profile-dropdown-item" onClick={toggleDarkMode}>
                    <span className="rs-profile-dropdown-icon">
                      {darkMode ? (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      ) : (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      )}
                    </span>
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  <Link
                    href="/settings"
                    className="rs-profile-dropdown-item"
                    onClick={() => setProfileOpen(false)}
                  >
                    <span className="rs-profile-dropdown-icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                    Settings
                  </Link>
                  <div className="rs-profile-dropdown-divider" />
                  <button className="rs-profile-dropdown-item rs-logout-item" onClick={logout}>
                    <span className="rs-profile-dropdown-icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </span>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="rs-main">
          {children}
        </main>
      </div>
    </div>
  );
}
