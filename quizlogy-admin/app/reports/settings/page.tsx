'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/lib/adminContext';
import { adsenseApi, adminApi } from '@/lib/api';
import '../reports.css';

export default function SettingsPage() {
  const { adminData } = useAdmin();

  // Profile info (persisted in localStorage)
  const [profileData, setProfileData] = useState({
    displayName: '',
    email: '',
    location: '',
    phone: '',
    website: '',
  });

  // Password change
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState('account');

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Editing state
  const [editing, setEditing] = useState(false);

  // Payment history
  const [payments, setPayments] = useState<Array<{
    monthKey: string;
    monthName: string;
    earnings: number;
    status: string;
  }>>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (adminData) {
      // Load saved profile data from localStorage
      const savedProfile = localStorage.getItem(`profile-${adminData.id}`);
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setProfileData(prev => ({ ...prev, ...parsed }));
      } else {
        setProfileData(prev => ({
          ...prev,
          displayName: adminData.username || '',
        }));
      }
    }
  }, [adminData]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPayments();
    }
  }, [activeTab]);

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const response = await adsenseApi.getMonthlyEarnings();
      setPayments(response.data || []);
    } catch {
      // ignore
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    // Save to localStorage
    if (adminData) {
      localStorage.setItem(`profile-${adminData.id}`, JSON.stringify(profileData));
    }
    await new Promise(resolve => setTimeout(resolve, 600));
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordData.currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await adminApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordSuccess('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to update password';
      setPasswordError(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getInitials = () => {
    const name = profileData.displayName || adminData?.username || '?';
    return name.slice(0, 2).toUpperCase();
  };

  const publisherId = adminData?.id ? adminData.id.slice(0, 8) : '---';
  const revenueShare = adminData?.adsenseRevenueShare ?? 100;
  const joinDate = adminData?.createdAt ? formatDate(adminData.createdAt) : '---';
  const domains = adminData?.adsenseAllowedDomains || [];
  const isSuperAdmin = adminData?.isSuperAdmin ?? false;

  return (
    <div className="settings-page-v2">
      <div className="settings-layout">
        {/* Left: Profile Card */}
        <div className="settings-profile-card">
          <div className="settings-profile-avatar-wrapper">
            {/* Default SVG Avatar */}
            <div className="settings-profile-avatar">
              <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="60" fill="#e8e0f3"/>
                <circle cx="60" cy="45" r="22" fill="#c4a8e0"/>
                <ellipse cx="60" cy="95" rx="35" ry="25" fill="#c4a8e0"/>
                <circle cx="60" cy="45" r="18" fill="#f5efe8"/>
                <circle cx="52" cy="42" r="2.5" fill="#4a3560"/>
                <circle cx="68" cy="42" r="2.5" fill="#4a3560"/>
                <path d="M55 52 Q60 57 65 52" stroke="#4a3560" strokeWidth="2" fill="none" strokeLinecap="round"/>
                <path d="M38 30 Q50 15 60 22 Q70 15 82 30" fill="#d4956b" stroke="none"/>
                <ellipse cx="60" cy="22" rx="18" ry="10" fill="#d4956b"/>
                <path d="M42 28 Q45 35 50 30" fill="#d4956b"/>
                <path d="M78 28 Q75 35 70 30" fill="#d4956b"/>
              </svg>
            </div>
          </div>

          <div className="settings-profile-name-row">
            <h2 className="settings-profile-name">{profileData.displayName || adminData?.username || 'Admin'}</h2>
            <span className={`settings-profile-badge ${isSuperAdmin ? 'super' : 'active'}`}>
              {isSuperAdmin ? 'super admin' : 'active'}
            </span>
          </div>

          <div className="settings-profile-details">
            <div className="settings-profile-detail-item">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
              <span>{publisherId}</span>
            </div>
            {profileData.location && (
              <div className="settings-profile-detail-item">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>{profileData.location}</span>
              </div>
            )}
            <div className="settings-profile-detail-item">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span>{joinDate}</span>
            </div>
            <div className="settings-profile-detail-item">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              <span>{revenueShare}%</span>
            </div>
          </div>

          <button
            className="settings-update-password-link"
            onClick={() => setShowPasswordModal(true)}
          >
            Update Password
          </button>
        </div>

        {/* Right: Details Area */}
        <div className="settings-details-area">
          {/* Tabs */}
          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              Account Details
            </button>
            <button
              className={`settings-tab ${activeTab === 'domains' ? 'active' : ''}`}
              onClick={() => setActiveTab('domains')}
            >
              Subdomains
            </button>
            <button
              className={`settings-tab ${activeTab === 'links' ? 'active' : ''}`}
              onClick={() => setActiveTab('links')}
            >
              Web/App Link
            </button>
            <button
              className={`settings-tab ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              Payment History
            </button>
          </div>

          {/* Tab Content */}
          <div className="settings-tab-content">
            {/* Account Details Tab */}
            {activeTab === 'account' && (
              <div className="settings-account-details">
                <div className="settings-account-header">
                  <h3>Account Information</h3>
                  {!editing ? (
                    <button className="settings-edit-btn" onClick={() => setEditing(true)}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit
                    </button>
                  ) : (
                    <div className="settings-edit-actions">
                      <button className="settings-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
                      <button className="settings-save-btn" onClick={handleSaveProfile} disabled={saving}>
                        {saving ? <span className="settings-save-spinner"></span> : null}
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>

                {saved && (
                  <div className="settings-success-msg">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Profile updated successfully!
                  </div>
                )}

                <div className="settings-form-grid">
                  <div className="settings-field">
                    <label>Display Name</label>
                    {editing ? (
                      <input
                        type="text"
                        name="displayName"
                        value={profileData.displayName}
                        onChange={handleProfileChange}
                        placeholder="Your display name"
                      />
                    ) : (
                      <p className="settings-field-value">{profileData.displayName || '---'}</p>
                    )}
                  </div>

                  <div className="settings-field">
                    <label>Email Address</label>
                    {editing ? (
                      <input
                        type="email"
                        name="email"
                        value={profileData.email}
                        onChange={handleProfileChange}
                        placeholder="your@email.com"
                      />
                    ) : (
                      <p className="settings-field-value">{profileData.email || '---'}</p>
                    )}
                  </div>

                  <div className="settings-field">
                    <label>Location</label>
                    {editing ? (
                      <input
                        type="text"
                        name="location"
                        value={profileData.location}
                        onChange={handleProfileChange}
                        placeholder="City, Country"
                      />
                    ) : (
                      <p className="settings-field-value">{profileData.location || '---'}</p>
                    )}
                  </div>

                  <div className="settings-field">
                    <label>Phone Number</label>
                    {editing ? (
                      <input
                        type="tel"
                        name="phone"
                        value={profileData.phone}
                        onChange={handleProfileChange}
                        placeholder="+91 XXXXX XXXXX"
                      />
                    ) : (
                      <p className="settings-field-value">{profileData.phone || '---'}</p>
                    )}
                  </div>

                  <div className="settings-field">
                    <label>Website</label>
                    {editing ? (
                      <input
                        type="url"
                        name="website"
                        value={profileData.website}
                        onChange={handleProfileChange}
                        placeholder="https://example.com"
                      />
                    ) : (
                      <p className="settings-field-value">{profileData.website || '---'}</p>
                    )}
                  </div>

                  <div className="settings-field">
                    <label>Publisher ID</label>
                    <p className="settings-field-value settings-field-mono">{publisherId}</p>
                  </div>

                  <div className="settings-field">
                    <label>Revenue Share</label>
                    <p className="settings-field-value">
                      <span className="settings-revenue-badge">{revenueShare}%</span>
                    </p>
                  </div>

                  <div className="settings-field">
                    <label>Member Since</label>
                    <p className="settings-field-value">{joinDate}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Subdomains Tab */}
            {activeTab === 'domains' && (
              <div className="settings-domains-tab">
                <h3>Allowed Subdomains</h3>
                <p className="settings-tab-desc">These are the domains assigned to your account for ad serving.</p>
                {domains.length === 0 ? (
                  <div className="settings-empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                    <p>No subdomains assigned yet</p>
                  </div>
                ) : (
                  <div className="settings-domain-list">
                    {domains.map((domain, i) => (
                      <div key={i} className="settings-domain-item">
                        <div className="settings-domain-icon">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                          </svg>
                        </div>
                        <span className="settings-domain-name">{domain}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Web/App Link Tab */}
            {activeTab === 'links' && (
              <div className="settings-links-tab">
                <h3>Web/App Links</h3>
                <p className="settings-tab-desc">Links associated with your publisher account.</p>
                {profileData.website ? (
                  <div className="settings-domain-list">
                    <div className="settings-domain-item">
                      <div className="settings-domain-icon link-icon">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                      </div>
                      <span className="settings-domain-name">{profileData.website}</span>
                    </div>
                  </div>
                ) : (
                  <div className="settings-empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    <p>No web/app links added yet. Add a website in Account Details.</p>
                  </div>
                )}
              </div>
            )}

            {/* Payment History Tab */}
            {activeTab === 'payments' && (
              <div className="settings-payments-tab">
                <h3>Payment History</h3>
                <p className="settings-tab-desc">Your monthly earnings and payment status.</p>
                {loadingPayments ? (
                  <div className="settings-empty-state">
                    <div className="settings-mini-spinner"></div>
                    <p>Loading payment history...</p>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="settings-empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                    <p>No payment history yet</p>
                  </div>
                ) : (
                  <div className="settings-payments-table-wrap">
                    <table className="settings-payments-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Earnings</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.monthKey}>
                            <td>{p.monthName}</td>
                            <td className="settings-payment-amount">${p.earnings.toFixed(2)}</td>
                            <td>
                              <span className={`settings-payment-status ${p.status}`}>
                                {p.status === 'approved' ? 'Paid' : p.status === 'pending' ? 'Pending' : p.status === 'rejected' ? 'Rejected' : 'Carryforward'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="settings-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>Update Password</h3>
              <button className="settings-modal-close" onClick={() => setShowPasswordModal(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {passwordError && (
              <div className="settings-modal-error">{passwordError}</div>
            )}
            {passwordSuccess && (
              <div className="settings-modal-success">{passwordSuccess}</div>
            )}

            <div className="settings-modal-body">
              <div className="settings-field">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={e => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Enter current password"
                />
              </div>
              <div className="settings-field">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                />
              </div>
              <div className="settings-field">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={e => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="settings-modal-footer">
              <button className="settings-cancel-btn" onClick={() => setShowPasswordModal(false)}>Cancel</button>
              <button className="settings-save-btn" onClick={handlePasswordChange} disabled={changingPassword}>
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
