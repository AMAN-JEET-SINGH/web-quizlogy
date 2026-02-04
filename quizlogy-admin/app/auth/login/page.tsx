'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/lib/adminContext';
import './login.css';

export default function AdminLogin() {
  const router = useRouter();
  const { login } = useAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // console.log(' Login form submitted:', { username, password: password ? '***' : 'empty' });

    try {
      await login(username, password);
      console.log('Login successful, redirecting to dashboard');
      router.push('/dashboard');
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
      
      // Better error messages for network errors
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
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h1>Admin Login</h1>
          <p>Enter your credentials to access the admin panel</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
            {error.includes('Cannot connect') && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#ffcccc' }}>
                <p>Make sure:</p>
                <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                  <li>Backend server is running on port 5000</li>
                  <li>API URL is correct: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}</li>
                  <li>No firewall is blocking the connection</li>
                </ul>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter admin username"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter admin password"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

