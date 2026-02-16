'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdmin, SidebarSection } from '@/lib/adminContext';
import './dashboard.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, loading, logout, adminData, canAccess } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const [questionBanksOpen, setQuestionBanksOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('reports-dark-mode');
    if (saved === 'true') {
      document.documentElement.setAttribute('data-theme', 'dark');
      setDarkMode(true);
    }
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

  useEffect(() => {
    // Only redirect if not loading and not admin, and not already on login page
    if (!loading && !isAdmin && pathname !== '/auth/login') {
      router.push('/auth/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, loading]); // Removed router and pathname from deps to prevent loops

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (path: string) => pathname === path;

  const closeSidebar = () => setSidebarOpen(false);

  // Check if any question bank section is accessible
  const hasQuestionBankAccess = canAccess('question-bank');

  // Map paths to sections for permission checking
  const getRequiredSection = (path: string): SidebarSection | null => {
    if (path === '/dashboard') return 'dashboard';
    if (path.includes('/dashboard/categories')) return 'categories';
    if (path.includes('/dashboard/contests')) return 'contests';
    if (path.includes('/dashboard/battles')) return 'battles';
    if (path.includes('/dashboard/question-bank') || path.includes('/dashboard/two-questions') || path.includes('/dashboard/battle-questions')) return 'question-bank';
    if (path.includes('/dashboard/funfacts')) return 'funfacts';
    if (path.includes('/dashboard/users')) return 'users';
    if (path.includes('/dashboard/contact-messages')) return 'contact-messages';
    if (path.includes('/dashboard/visitors')) return 'visitors';
    if (path.includes('/dashboard/analytics')) return 'analytics';
    if (path.includes('/dashboard/adsense')) return 'adsense';
    if (path.includes('/dashboard/gallery')) return 'gallery';
    if (path.includes('/dashboard/admin-users')) return null; // Super admin only, handled separately
    return null;
  };

  // Get the first allowed section path for redirect
  const getFirstAllowedPath = (): string => {
    if (adminData?.isSuperAdmin) return '/dashboard';
    if (!adminData) return '/dashboard';

    // If user has adsense access, redirect to the reports section
    if (adminData.allowedSections.includes('adsense')) {
      return '/reports';
    }

    const sectionPaths: Record<string, string> = {
      'dashboard': '/dashboard',
      'categories': '/dashboard/categories',
      'contests': '/dashboard/contests',
      'battles': '/dashboard/battles',
      'question-bank': '/dashboard/question-bank',
      'funfacts': '/dashboard/funfacts',
      'users': '/dashboard/users',
      'contact-messages': '/dashboard/contact-messages',
      'visitors': '/dashboard/visitors',
      'analytics': '/dashboard/analytics',
      'gallery': '/dashboard/gallery',
    };

    for (const section of adminData.allowedSections) {
      if (sectionPaths[section]) {
        return sectionPaths[section];
      }
    }
    return '/dashboard'; // Fallback
  };

  // Check current route permission - must be before conditional returns
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loading || !isAdmin || !adminData) return;

    // Super admin has access to everything
    if (adminData.isSuperAdmin) return;

    // Check if current path is admin-users (super admin only)
    if (pathname.includes('/dashboard/admin-users')) {
      const firstPath = getFirstAllowedPath();
      router.push(firstPath);
      return;
    }

    const requiredSection = getRequiredSection(pathname);

    // If no specific section required or user has access, allow
    if (!requiredSection) return;
    if (canAccess(requiredSection)) return;

    // Redirect to first allowed section
    const firstPath = getFirstAllowedPath();
    router.push(firstPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loading, isAdmin, adminData, canAccess, router]);

  // Loading state - after all hooks
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Not admin state - after all hooks
  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--admin-bg, #f8f9fa)',
        padding: 24,
      }}>
        <p style={{ marginBottom: 16, fontSize: 16, color: '#6b7280' }}>
          Redirecting to login...
        </p>
        <a href="/auth/login" style={{ color: '#111827', fontWeight: 600 }}>
          Go to login
        </a>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/QuizangoLogo.svg" alt="Quizango" className="sidebar-logo" />
          {adminData && (
            <div className="sidebar-user-info">
              <span className="sidebar-username">{adminData.username}</span>
              {adminData.isSuperAdmin && (
                <span className="sidebar-badge super-admin">Super Admin</span>
              )}
            </div>
          )}
        </div>
        <nav className="sidebar-nav">
          {canAccess('dashboard') && (
            <Link
              href="/dashboard"
              className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
              title="View dashboard analytics and overview"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              Dashboard
            </Link>
          )}

          {/* Admin Users - Super Admin Only */}
          {adminData?.isSuperAdmin && (
            <Link
              href="/dashboard/admin-users"
              className={`nav-link ${isActive('/dashboard/admin-users') ? 'active' : ''}`}
              title="Manage admin users"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Admin Users
            </Link>
          )}

          {canAccess('categories') && (
            <Link
              href="/dashboard/categories"
              className={`nav-link ${isActive('/dashboard/categories') ? 'active' : ''}`}
              title="Manage quiz categories"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Manage Categories
            </Link>
          )}

          {canAccess('contests') && (
            <Link
              href="/dashboard/contests"
              className={`nav-link ${isActive('/dashboard/contests') ? 'active' : ''}`}
              title="Create and manage quiz contests"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Manage Contests
            </Link>
          )}

          {canAccess('battles') && (
            <Link
              href="/dashboard/battles"
              className={`nav-link ${isActive('/dashboard/battles') ? 'active' : ''}`}
              title="Create and manage battles"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Manage Battles
            </Link>
          )}

          {/* Question Banks Section */}
          {hasQuestionBankAccess && (
            <div className="nav-section">
              <button
                className={`nav-link nav-section-header ${questionBanksOpen ? 'open' : ''}`}
                onClick={() => setQuestionBanksOpen(!questionBanksOpen)}
                title="Manage questions for different quiz types"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Question Banks
                </span>
                <span className="nav-arrow">{questionBanksOpen ? '▼' : '▶'}</span>
              </button>
              {questionBanksOpen && (
                <div className="nav-submenu">
                  <Link
                    href="/dashboard/question-bank"
                    className={`nav-link nav-submenu-item ${isActive('/dashboard/question-bank') ? 'active' : ''}`}
                    title="View, edit, delete and filter contest questions"
                    onClick={closeSidebar}
                  >
                    <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Contest Questions
                  </Link>
                  <Link
                    href="/dashboard/two-questions"
                    className={`nav-link nav-submenu-item ${isActive('/dashboard/two-questions') ? 'active' : ''}`}
                    title="Manage intro two questions"
                    onClick={closeSidebar}
                  >
                    <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Intro Two Questions
                  </Link>
                  <Link
                    href="/dashboard/battle-questions"
                    className={`nav-link nav-submenu-item ${isActive('/dashboard/battle-questions') ? 'active' : ''}`}
                    title="Add battle questions"
                    onClick={closeSidebar}
                  >
                    <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Add Battle Question
                  </Link>
                </div>
              )}
            </div>
          )}

          {canAccess('funfacts') && (
            <Link
              href="/dashboard/funfacts"
              className={`nav-link ${isActive('/dashboard/funfacts') ? 'active' : ''}`}
              title="Create and manage fun facts"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Manage Fun Facts
            </Link>
          )}

          {canAccess('users') && (
            <Link
              href="/dashboard/users"
              className={`nav-link ${isActive('/dashboard/users') ? 'active' : ''}`}
              title="View and manage user accounts and profiles"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Users
            </Link>
          )}

          {canAccess('contact-messages') && (
            <Link
              href="/dashboard/contact-messages"
              className={`nav-link ${isActive('/dashboard/contact-messages') ? 'active' : ''}`}
              title="View and manage contact messages from users"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Messages
            </Link>
          )}

          {canAccess('visitors') && (
            <Link
              href="/dashboard/visitors"
              className={`nav-link ${isActive('/dashboard/visitors') ? 'active' : ''}`}
              title="View and manage visitor IPs and analytics"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Visitor IPs
            </Link>
          )}

          {canAccess('analytics') && (
            <Link
              href="/dashboard/analytics"
              className={`nav-link ${isActive('/dashboard/analytics') ? 'active' : ''}`}
              title="View traffic analytics and source tracking"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </Link>
          )}

          {/* AdSense - Super Admin Only (Limited admins use /reports) */}
          {adminData?.isSuperAdmin && canAccess('adsense') && (
            <Link
              href="/dashboard/adsense"
              className={`nav-link ${isActive('/dashboard/adsense') ? 'active' : ''}`}
              title="View AdSense earnings and performance"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              AdSense
            </Link>
          )}

          {/* Countries - Super Admin Only */}
          {adminData?.isSuperAdmin && (
            <Link
              href="/dashboard/countries"
              className={`nav-link ${isActive('/dashboard/countries') ? 'active' : ''}`}
              title="Manage countries for content targeting"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Countries
            </Link>
          )}

          {/* Invoice Requests - Super Admin Only */}
          {adminData?.isSuperAdmin && (
            <Link
              href="/dashboard/invoice-requests"
              className={`nav-link ${isActive('/dashboard/invoice-requests') ? 'active' : ''}`}
              title="Manage invoice payout requests"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Invoice Requests
            </Link>
          )}

          {canAccess('gallery') && (
            <Link
              href="/dashboard/gallery"
              className={`nav-link ${isActive('/dashboard/gallery') ? 'active' : ''}`}
              title="Manage uploaded images and gallery"
              onClick={closeSidebar}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image Gallery
            </Link>
          )}
        </nav>
        <div className="sidebar-footer">
          <button onClick={toggleDarkMode} className="btn-dark-toggle">
            {darkMode ? (
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={() => { handleLogout(); closeSidebar(); }} className="btn-logout">
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>Admin Dashboard</h1>
        </header>
        <div className="dashboard-content">
          {children}
        </div>
      </main>
    </div>
  );
}
