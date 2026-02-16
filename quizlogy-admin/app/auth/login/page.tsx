'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin, AdminData } from '@/lib/adminContext';
import './login.css';

// Get the first allowed section path for redirect after login
const getFirstAllowedPath = (adminData: AdminData | null): string => {
  if (!adminData) return '/dashboard';
  if (adminData.isSuperAdmin) return '/dashboard';

  // If user has adsense access, redirect to the reports overview
  if (adminData.allowedSections.includes('adsense')) {
    return '/reports/overview';
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
  return '/dashboard';
};

export default function AdminLogin() {
  const router = useRouter();
  const { login } = useAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotMsg, setShowForgotMsg] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!termsAccepted) {
      setError('You must accept the Terms & Conditions to sign in.');
      return;
    }

    setLoading(true);

    try {
      const loggedInAdminData = await login(username, password);
      const redirectPath = getFirstAllowedPath(loggedInAdminData);
      console.log('Login successful, redirecting to:', redirectPath);
      router.push(redirectPath);
    } catch (err: any) {
      console.error('Login error in form:', {
        error: err,
        response: err.response,
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        code: err.code,
        request: err.request,
      });

      if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || !err.response) {
        setError('Cannot connect to server. Please make sure the backend server is running on port 5000.');
      } else if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Top gradient bar */}
      <div className="login-top-bar" />

      <div className="login-content">
        {/* Left illustration panel */}
        <div className="login-illustration login-animate-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/picgrow.jpg" alt="Grow Your Business" className="login-illustration-img" />
        </div>

        {/* Right form panel */}
        <div className="login-form-panel login-animate-right">
          <div className="login-form-wrapper">
            <h1>Grow Your Business with Us!</h1>
            <p className="login-subtitle">Sign in to your Business Account</p>

            {error && (
              <div className="login-error">
                {error}
                {error.includes('Cannot connect') && (
                  <div className="error-details">
                    <p>Make sure:</p>
                    <ul>
                      <li>Backend server is running on port 5000</li>
                      <li>API URL is correct: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}</li>
                      <li>No firewall is blocking the connection</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="input-group login-animate-input" style={{ animationDelay: '0.15s' }}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Email id"
                  disabled={loading}
                />
              </div>

              <div className="input-group login-animate-input" style={{ animationDelay: '0.25s' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Password"
                  disabled={loading}
                  className="has-toggle"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <label htmlFor="terms">
                  Accept <a href="/auth/terms" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>
                </label>
              </div>

              <div className="remember-forgot-row">
                <div className="checkbox-row">
                  <input type="checkbox" id="remember" />
                  <label htmlFor="remember">Remember me.</label>
                </div>
                <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); setShowForgotMsg(true); }}>
                  Forgot Password?
                </a>
              </div>

              {showForgotMsg && (
                <div className="forgot-msg">
                  Please contact your admin to reset your password.
                </div>
              )}

              <button type="submit" className="btn-signin" disabled={loading || !termsAccepted}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

