'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/lib/adminContext';
import '../reports.css';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastActive: string;
}

export default function UsersPage() {
  const { adminData } = useAdmin();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated user data - replace with actual API call
    const mockUsers: User[] = [
      {
        id: '1',
        name: adminData?.username || 'Current User',
        email: 'user@example.com',
        role: 'Account Owner',
        status: 'active',
        lastActive: new Date().toISOString(),
      },
    ];

    setTimeout(() => {
      setUsers(mockUsers);
      setLoading(false);
    }, 500);
  }, [adminData]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="reports-loading">
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="reports-page-header">
        <h1 className="reports-page-title">Users</h1>
        <p className="reports-page-subtitle">Manage users with access to your reports</p>
      </div>

      {/* Users Table */}
      <div className="reports-card">
        <div className="reports-card-header">
          <h2 className="reports-card-title">Team Members</h2>
          <button
            style={{
              padding: '8px 16px',
              background: '#111827',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            + Invite User
          </button>
        </div>

        {users.length === 0 ? (
          <div className="reports-empty">
            <svg className="reports-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3>No team members</h3>
            <p>Invite users to give them access to reports.</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="users-table .user-avatar" style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: '600',
                      }}>
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: '500' }}>{user.name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{user.role}</td>
                  <td>
                    <span className={`users-badge ${user.status}`}>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                  <td>{formatDate(user.lastActive)}</td>
                  <td>
                    <button
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        marginRight: '8px',
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Access Info */}
      <div className="reports-card">
        <div className="settings-section">
          <h3 className="settings-section-title">Access Information</h3>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Users with access to this reports section can view AdSense revenue data,
            download reports, and access invoicing information. Account owners can
            invite additional team members and manage their access levels.
          </p>
        </div>
      </div>
    </div>
  );
}
