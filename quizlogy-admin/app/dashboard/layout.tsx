'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '@/lib/adminContext';
import './dashboard.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, loading, logout } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const [questionBanksOpen, setQuestionBanksOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const isActive = (path: string) => pathname === path;

  const closeSidebar = () => setSidebarOpen(false);

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
          <h2>Admin Panel</h2>
        </div>
        <nav className="sidebar-nav">
          <Link 
            href="/dashboard" 
            className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
            title="View dashboard analytics and overview"
            onClick={closeSidebar}
          >
            Dashboard
          </Link>
          <Link 
            href="/dashboard/categories" 
            className={`nav-link ${isActive('/dashboard/categories') ? 'active' : ''}`}
            title="Manage quiz categories"
            onClick={closeSidebar}
          >
            Manage Categories
          </Link>
          <Link 
            href="/dashboard/contests" 
            className={`nav-link ${isActive('/dashboard/contests') ? 'active' : ''}`}
            title="Create and manage quiz contests"
            onClick={closeSidebar}
          >
            Manage Contests
          </Link>
          <Link 
            href="/dashboard/battles" 
            className={`nav-link ${isActive('/dashboard/battles') ? 'active' : ''}`}
            title="Create and manage battles"
            onClick={closeSidebar}
          >
            Manage Battles
          </Link>
          
          {/* Question Banks Section */}
          <div className="nav-section">
            <button
              className={`nav-link nav-section-header ${questionBanksOpen ? 'open' : ''}`}
              onClick={() => setQuestionBanksOpen(!questionBanksOpen)}
              title="Manage questions for different quiz types"
            >
              <span>Question Banks</span>
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
                  Contest Questions
                </Link>
                <Link 
                  href="/dashboard/question-bank?type=prediction" 
                  className={`nav-link nav-submenu-item ${pathname.includes('prediction') ? 'active' : ''}`}
                  title="Manage prediction questions"
                  onClick={closeSidebar}
                >
                  Prediction Questions
                </Link>
                <Link 
                  href="/dashboard/two-questions" 
                  className={`nav-link nav-submenu-item ${isActive('/dashboard/two-questions') ? 'active' : ''}`}
                  title="Manage intro two questions"
                  onClick={closeSidebar}
                >
                  Intro Two Questions
                </Link>
                <Link 
                  href="/dashboard/battle-questions" 
                  className={`nav-link nav-submenu-item ${isActive('/dashboard/battle-questions') ? 'active' : ''}`}
                  title="Add battle questions"
                  onClick={closeSidebar}
                >
                  Add Battle Question
                </Link>
              </div>
            )}
          </div>
          
          <Link
            href="/dashboard/funfacts"
            className={`nav-link ${isActive('/dashboard/funfacts') ? 'active' : ''}`}
            title="Create and manage fun facts"
            onClick={closeSidebar}
          >
            Manage Fun Facts
          </Link>
          <Link
            href="/dashboard/users"
            className={`nav-link ${isActive('/dashboard/users') ? 'active' : ''}`}
            title="View and manage user accounts and profiles"
            onClick={closeSidebar}
          >
            Users
          </Link>
          <Link
            href="/dashboard/contact-messages"
            className={`nav-link ${isActive('/dashboard/contact-messages') ? 'active' : ''}`}
            title="View and manage contact messages from users"
            onClick={closeSidebar}
          >
            Contact Messages
          </Link>
          <Link
            href="/dashboard/visitors"
            className={`nav-link ${isActive('/dashboard/visitors') ? 'active' : ''}`}
            title="View and manage visitor IPs and analytics"
            onClick={closeSidebar}
          >
            Visitor IPs
          </Link>
          <Link
            href="/dashboard/analytics"
            className={`nav-link ${isActive('/dashboard/analytics') ? 'active' : ''}`}
            title="View traffic analytics and source tracking"
            onClick={closeSidebar}
          >
            <svg style={{ width: '16px', height: '16px', marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </Link>
          <Link
            href="/dashboard/gallery"
            className={`nav-link ${isActive('/dashboard/gallery') ? 'active' : ''}`}
            title="Manage uploaded images and gallery"
            onClick={closeSidebar}
          >
            Image Gallery
          </Link>
        </nav>
        <div className="sidebar-footer">
          <button onClick={() => { handleLogout(); closeSidebar(); }} className="btn-logout">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
