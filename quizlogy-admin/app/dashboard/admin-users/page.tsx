'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin, SIDEBAR_SECTIONS } from '@/lib/adminContext';
import { adminUsersApi, adsenseApi, appSettingsApi, AdminUser, CreateAdminUserData, UpdateAdminUserData } from '@/lib/api';
import './admin-users.css';

interface FormData {
  username: string;
  password: string;
  allowedSections: string[];
  adsenseAllowedDomains: string[];
  adsenseDomainDeductions: Record<string, number>;
  webAppLinks: Array<{label: string; url: string}>;
  isActive: boolean;
}

const initialFormData: FormData = {
  username: '',
  password: '',
  allowedSections: [],
  adsenseAllowedDomains: [],
  adsenseDomainDeductions: {},
  webAppLinks: [],
  isActive: true,
};

type ViewMode = 'list' | 'create' | 'edit';

// Section display names and icons
const SECTION_INFO: Record<string, { label: string; icon: JSX.Element }> = {
  'dashboard': {
    label: 'Dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>
  },
  'categories': {
    label: 'Categories',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
  },
  'contests': {
    label: 'Contests',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
  },
  'battles': {
    label: 'Battles',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  },
  'question-bank': {
    label: 'Questions',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  'funfacts': {
    label: 'Fun Facts',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
  },
  'users': {
    label: 'Users',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
  },
  'contact-messages': {
    label: 'Messages',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
  },
  'visitors': {
    label: 'Visitors',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
  },
  'analytics': {
    label: 'Analytics',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  },
  'adsense': {
    label: 'AdSense',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  'gallery': {
    label: 'Gallery',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  },
};

export default function AdminUsersPage() {
  const { adminData } = useAdmin();
  const router = useRouter();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [viewingAdmin, setViewingAdmin] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [domainSearch, setDomainSearch] = useState('');

  // Deduction modal state
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [deductionPercent, setDeductionPercent] = useState(0);
  const [deductionLoading, setDeductionLoading] = useState(false);
  const [deductionSaving, setDeductionSaving] = useState(false);

  useEffect(() => {
    if (adminData && !adminData.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [adminData, router]);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await adminUsersApi.getAll();
      setAdmins(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch admin users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdsenseOptions = async () => {
    if (availableDomains.length > 0) return;

    try {
      setLoadingOptions(true);
      const domainsRes = await adsenseApi.getDomains();
      setAvailableDomains(domainsRes.domains || []);
    } catch (err) {
      console.error('Failed to fetch AdSense options:', err);
    } finally {
      setLoadingOptions(false);
    }
  };

  const openDeductionModal = async () => {
    setShowDeductionModal(true);
    setDeductionLoading(true);
    try {
      const res = await appSettingsApi.get();
      setDeductionPercent(res.data.revenueDeductPercent);
    } catch (err) {
      console.error('Failed to fetch app settings:', err);
    } finally {
      setDeductionLoading(false);
    }
  };

  const saveDeduction = async () => {
    try {
      setDeductionSaving(true);
      await appSettingsApi.update({ revenueDeductPercent: deductionPercent });
      setShowDeductionModal(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save deduction');
    } finally {
      setDeductionSaving(false);
    }
  };

  useEffect(() => {
    if (adminData?.isSuperAdmin) {
      fetchAdmins();
    }
  }, [adminData]);

  useEffect(() => {
    if (formData.allowedSections.includes('adsense')) {
      fetchAdsenseOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.allowedSections]);

  const handleCreate = () => {
    setEditingAdmin(null);
    setFormData(initialFormData);
    setError(null);
    setSuccess(null);
    setViewMode('create');
  };

  const handleEdit = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setFormData({
      username: admin.username,
      password: '',
      allowedSections: admin.allowedSections,
      adsenseAllowedDomains: admin.adsenseAllowedDomains,
      adsenseDomainDeductions: admin.adsenseDomainDeductions || {},
      webAppLinks: admin.webAppLinks || [],
      isActive: admin.isActive,
    });
    setError(null);
    setSuccess(null);
    setViewMode('edit');
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingAdmin(null);
    setFormData(initialFormData);
    setError(null);
    setSuccess(null);
  };

  const handleView = (admin: AdminUser) => {
    setViewingAdmin(admin);
  };

  const closeViewModal = () => {
    setViewingAdmin(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (editingAdmin) {
        const isAdsense = formData.allowedSections.includes('adsense');
        const updateData: UpdateAdminUserData = {
          username: formData.username,
          allowedSections: formData.allowedSections,
          adsenseAllowedDomains: isAdsense ? formData.adsenseAllowedDomains : [],
          adsenseAllowedCountries: [],
          adsenseRevenueShare: 100,
          adsenseDomainDeductions: isAdsense ? formData.adsenseDomainDeductions : {},
          webAppLinks: formData.webAppLinks.filter(l => l.label.trim() && l.url.trim()),
          isActive: formData.isActive,
        };

        if (formData.password) {
          updateData.password = formData.password;
        }

        await adminUsersApi.update(editingAdmin.id, updateData);
        setSuccess('Admin user updated successfully');
      } else {
        const isAdsense = formData.allowedSections.includes('adsense');
        const createData: CreateAdminUserData = {
          username: formData.username,
          password: formData.password,
          allowedSections: formData.allowedSections,
          adsenseAllowedDomains: isAdsense ? formData.adsenseAllowedDomains : [],
          adsenseAllowedCountries: [],
          adsenseRevenueShare: 100,
          adsenseDomainDeductions: isAdsense ? formData.adsenseDomainDeductions : {},
          webAppLinks: formData.webAppLinks.filter(l => l.label.trim() && l.url.trim()),
          isActive: formData.isActive,
        };

        await adminUsersApi.create(createData);
        setSuccess('Admin user created successfully');
      }

      fetchAdmins();
      setTimeout(() => {
        setViewMode('list');
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save admin user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin: AdminUser) => {
    if (!confirm(`Are you sure you want to delete admin "${admin.username}"?`)) {
      return;
    }

    try {
      await adminUsersApi.delete(admin.id);
      fetchAdmins();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete admin user');
    }
  };

  const handleToggleActive = async (admin: AdminUser) => {
    try {
      await adminUsersApi.toggleActive(admin.id);
      fetchAdmins();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to toggle admin status');
    }
  };

  const toggleSection = (section: string) => {
    setFormData(prev => ({
      ...prev,
      allowedSections: prev.allowedSections.includes(section)
        ? prev.allowedSections.filter(s => s !== section)
        : [...prev.allowedSections, section],
    }));
  };

  const toggleDomain = (domain: string) => {
    setFormData(prev => {
      const isRemoving = prev.adsenseAllowedDomains.includes(domain);
      const newDomains = isRemoving
        ? prev.adsenseAllowedDomains.filter(d => d !== domain)
        : [...prev.adsenseAllowedDomains, domain];
      const newDeductions = { ...prev.adsenseDomainDeductions };
      if (isRemoving) {
        delete newDeductions[domain];
      } else {
        newDeductions[domain] = 0;
      }
      return { ...prev, adsenseAllowedDomains: newDomains, adsenseDomainDeductions: newDeductions };
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const isAdsenseSelected = formData.allowedSections.includes('adsense');

  // Filtered domains and countries based on search
  const filteredDomains = availableDomains.filter(d =>
    d.toLowerCase().includes(domainSearch.toLowerCase())
  );

  const handleDomainDeductionChange = (domain: string, value: string) => {
    const num = parseInt(value, 10);
    const clamped = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
    setFormData(prev => ({
      ...prev,
      adsenseDomainDeductions: { ...prev.adsenseDomainDeductions, [domain]: clamped },
    }));
  };

  // Stats
  const totalAdmins = admins.length;
  const activeAdmins = admins.filter(a => a.isActive).length;
  const superAdmins = admins.filter(a => a.isSuperAdmin).length;

  if (!adminData?.isSuperAdmin) {
    return (
      <div className="admin-users-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Create/Edit Form View
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="admin-users-page">
        <div className="page-header">
          <button className="btn-back" onClick={handleCancel}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="page-title">
            <h1>{viewMode === 'create' ? 'Create New Admin' : 'Edit Admin'}</h1>
            {editingAdmin && <span className="subtitle">Editing: {editingAdmin.username}</span>}
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {success}
          </div>
        )}

        <div className="form-layout">
          <div className="form-main">
            <div className="form-card">
              <div className="form-card-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h2>Account Details</h2>
              </div>
              <div className="form-card-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={e => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Enter username"
                      disabled={editingAdmin?.isSuperAdmin}
                    />
                    <span className="form-hint">Minimum 3 characters</span>
                  </div>
                  <div className="form-group">
                    <label>{editingAdmin ? 'New Password' : 'Password'}</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingAdmin ? 'Leave empty to keep current' : 'Enter password'}
                    />
                    <span className="form-hint">Minimum 6 characters</span>
                  </div>
                </div>

                {!editingAdmin?.isSuperAdmin && (
                  <div className="form-group">
                    <label className="toggle-label">
                      <span className="toggle-text">
                        <strong>Account Status</strong>
                        <small>Enable or disable this admin account</small>
                      </span>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {!editingAdmin?.isSuperAdmin && (
              <>
                <div className="form-card">
                  <div className="form-card-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h2>Access Permissions</h2>
                  </div>
                  <div className="form-card-body">
                    <p className="section-description">Select which sections this admin can access</p>
                    <div className="permissions-grid">
                      {SIDEBAR_SECTIONS.map(section => (
                        <label
                          key={section}
                          className={`permission-card ${formData.allowedSections.includes(section) ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.allowedSections.includes(section)}
                            onChange={() => toggleSection(section)}
                          />
                          <div className="permission-icon">
                            {SECTION_INFO[section]?.icon}
                          </div>
                          <span className="permission-label">{SECTION_INFO[section]?.label || section}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {isAdsenseSelected && (
                  <div className="form-card adsense-card">
                    <div className="form-card-header">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h2>AdSense Settings</h2>
                    </div>
                    <div className="form-card-body">
                      {loadingOptions ? (
                        <div className="loading-inline">
                          <div className="loading-spinner small"></div>
                          <span>Loading options...</span>
                        </div>
                      ) : (
                        <>
                          <div className="form-group">
                            <label>Allowed Domains</label>
                            <p className="field-description">Leave empty to allow all domains</p>
                            {availableDomains.length === 0 ? (
                              <div className="empty-notice">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                No domains found. Fetch AdSense reports first.
                              </div>
                            ) : (
                              <>
                                {formData.adsenseAllowedDomains.length > 0 && (
                                  <div className="selected-items">
                                    {formData.adsenseAllowedDomains.map(domain => (
                                      <span key={domain} className="selected-tag">
                                        {domain}
                                        <button type="button" onClick={() => toggleDomain(domain)}>×</button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="search-select">
                                  <div className="search-input-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                      type="text"
                                      placeholder="Search domains..."
                                      value={domainSearch}
                                      onChange={e => setDomainSearch(e.target.value)}
                                      className="search-input"
                                    />
                                    {domainSearch && (
                                      <button type="button" className="clear-search" onClick={() => setDomainSearch('')}>×</button>
                                    )}
                                  </div>
                                  <div className="options-list">
                                    {filteredDomains.length === 0 ? (
                                      <div className="no-results">No domains match &quot;{domainSearch}&quot;</div>
                                    ) : (
                                      filteredDomains.map(domain => (
                                        <label
                                          key={domain}
                                          className={`option-item ${formData.adsenseAllowedDomains.includes(domain) ? 'selected' : ''}`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={formData.adsenseAllowedDomains.includes(domain)}
                                            onChange={() => toggleDomain(domain)}
                                          />
                                          <span className="option-checkbox">
                                            {formData.adsenseAllowedDomains.includes(domain) && (
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </span>
                                          <span className="option-label">{domain}</span>
                                        </label>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {formData.adsenseAllowedDomains.length > 0 && (
                            <div className="form-group">
                              <label>Per-Domain Deduction</label>
                              <p className="field-description">Set a deduction % for each domain. Client sees earnings after this deduction.</p>
                              <div className="domain-deductions-list">
                                {formData.adsenseAllowedDomains.map(domain => {
                                  const pct = formData.adsenseDomainDeductions[domain] ?? 0;
                                  const clientSees = 100 - pct;
                                  return (
                                    <div key={domain} className="domain-deduction-row">
                                      <span className="domain-deduction-name">{domain}</span>
                                      <div className="domain-deduction-control">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={pct}
                                          onChange={e => handleDomainDeductionChange(domain, e.target.value)}
                                          className="domain-deduction-input"
                                        />
                                        <span className="domain-deduction-suffix">% deduct</span>
                                      </div>
                                      <span className="domain-deduction-preview">
                                        Client sees {clientSees}%
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="form-card">
                  <div className="form-card-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    <h2>Web/App Links</h2>
                  </div>
                  <div className="form-card-body">
                    <p className="section-description">Add labeled links visible in this admin&apos;s Settings page</p>
                    {formData.webAppLinks.map((link, index) => (
                      <div key={index} className="form-row" style={{ alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          {index === 0 && <label>Label</label>}
                          <input
                            type="text"
                            value={link.label}
                            onChange={e => {
                              const updated = [...formData.webAppLinks];
                              updated[index] = { ...updated[index], label: e.target.value };
                              setFormData({ ...formData, webAppLinks: updated });
                            }}
                            placeholder="e.g. Website, Play Store"
                          />
                        </div>
                        <div className="form-group" style={{ flex: 2 }}>
                          {index === 0 && <label>URL</label>}
                          <input
                            type="url"
                            value={link.url}
                            onChange={e => {
                              const updated = [...formData.webAppLinks];
                              updated[index] = { ...updated[index], url: e.target.value };
                              setFormData({ ...formData, webAppLinks: updated });
                            }}
                            placeholder="https://..."
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-action btn-delete"
                          style={{ marginBottom: '2px', minWidth: '36px', height: '36px' }}
                          onClick={() => {
                            const updated = formData.webAppLinks.filter((_, i) => i !== index);
                            setFormData({ ...formData, webAppLinks: updated });
                          }}
                          title="Remove link"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ marginTop: '4px' }}
                      onClick={() => {
                        setFormData({
                          ...formData,
                          webAppLinks: [...formData.webAppLinks, { label: '', url: '' }],
                        });
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Link
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="form-sidebar">
            <div className="form-card sticky">
              <div className="form-card-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h2>Actions</h2>
              </div>
              <div className="form-card-body">
                <div className="action-summary">
                  <div className="summary-item">
                    <span className="summary-label">Sections</span>
                    <span className="summary-value">{formData.allowedSections.length} selected</span>
                  </div>
                  {isAdsenseSelected && formData.adsenseAllowedDomains.length > 0 && (
                    <div className="summary-item">
                      <span className="summary-label">Domains</span>
                      <span className="summary-value">{formData.adsenseAllowedDomains.length} with deductions</span>
                    </div>
                  )}
                  <div className="summary-item">
                    <span className="summary-label">Web/App Links</span>
                    <span className="summary-value">{formData.webAppLinks.filter(l => l.label.trim() && l.url.trim()).length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Status</span>
                    <span className={`summary-value ${formData.isActive ? 'active' : 'inactive'}`}>
                      {formData.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="action-buttons-vertical">
                  <button
                    className="btn-primary"
                    onClick={handleSave}
                    disabled={saving || !formData.username || (!editingAdmin && !formData.password)}
                  >
                    {saving ? (
                      <>
                        <div className="btn-spinner"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {editingAdmin ? 'Update Admin' : 'Create Admin'}
                      </>
                    )}
                  </button>
                  <button className="btn-secondary" onClick={handleCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="admin-users-page">
      <div className="page-header list-header">
        <div className="page-title">
          <h1>Admin Users</h1>
          <span className="subtitle">Manage administrator accounts and permissions</span>
        </div>
        <div className="header-actions">
          <button className="btn-deduction" onClick={openDeductionModal}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Platform Deduction
          </button>
          <button className="btn-primary" onClick={handleCreate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Admin
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{totalAdmins}</span>
            <span className="stat-label">Total Admins</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{activeAdmins}</span>
            <span className="stat-label">Active</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{superAdmins}</span>
            <span className="stat-label">Super Admins</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading admin users...</p>
        </div>
      ) : admins.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3>No Admin Users</h3>
          <p>Create your first admin user to get started.</p>
          <button className="btn-primary" onClick={handleCreate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add First Admin
          </button>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table-modern">
            <thead>
              <tr>
                <th className="th-user">Admin User</th>
                <th className="th-status">Status</th>
                <th className="th-sections">Access Permissions</th>
                <th className="th-revenue">Domain Deductions</th>
                <th className="th-login">Last Activity</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin, index) => (
                <tr key={admin.id} className={`table-row ${!admin.isActive ? 'row-inactive' : ''} ${admin.isSuperAdmin ? 'row-super' : ''}`}>
                  <td className="td-user">
                    <div className="user-info-cell">
                      <div className={`user-avatar ${admin.isSuperAdmin ? 'avatar-super' : ''}`}>
                        {getInitials(admin.username)}
                        {admin.isSuperAdmin && (
                          <span className="avatar-crown">👑</span>
                        )}
                      </div>
                      <div className="user-details">
                        <span className="user-name">{admin.username}</span>
                        <span className="user-role">
                          {admin.isSuperAdmin ? 'Super Administrator' : 'Limited Admin'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="td-status">
                    <div className={`status-pill ${admin.isActive ? 'pill-active' : 'pill-inactive'}`}>
                      <span className="status-dot"></span>
                      {admin.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </td>
                  <td className="td-sections">
                    {admin.isSuperAdmin ? (
                      <div className="access-full">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Full Access
                      </div>
                    ) : admin.allowedSections.length === 0 ? (
                      <div className="access-none">No Access</div>
                    ) : (
                      <div className="access-limited">
                        <span className="access-count">{admin.allowedSections.length}</span>
                        <span className="access-label">sections</span>
                      </div>
                    )}
                  </td>
                  <td className="td-revenue">
                    {(() => {
                      const deductions = admin.adsenseDomainDeductions || {};
                      const entries = Object.entries(deductions);
                      if (entries.length === 0) {
                        return <span className="no-deductions">None</span>;
                      }
                      return (
                        <div className="deduction-chips">
                          {entries.map(([domain, pct]) => (
                            <span key={domain} className={`deduction-chip ${Number(pct) > 0 ? 'has-deduction' : ''}`}>
                              {domain.replace(/^www\./, '').split('.')[0]}: {pct}%
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="td-login">
                    {admin.lastLogin ? (
                      <div className="login-info">
                        <span className="login-date">{formatDate(admin.lastLogin)}</span>
                      </div>
                    ) : (
                      <span className="login-never">Never logged in</span>
                    )}
                  </td>
                  <td className="td-actions">
                    <div className="actions-group">
                      <button
                        className="btn-action btn-view"
                        onClick={() => handleView(admin)}
                        title="View Details"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      <button
                        className="btn-action btn-edit"
                        onClick={() => handleEdit(admin)}
                        disabled={admin.isSuperAdmin && admin.id !== adminData.id}
                        title="Edit"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      {!admin.isSuperAdmin && (
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(admin)}
                          title="Delete"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Admin Modal */}
      {viewingAdmin && (
        <div className="modal-overlay" onClick={closeViewModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className={`modal-avatar ${viewingAdmin.isSuperAdmin ? 'avatar-super' : ''}`}>
                  {getInitials(viewingAdmin.username)}
                </div>
                <div>
                  <h2>{viewingAdmin.username}</h2>
                  <span className="modal-subtitle">
                    {viewingAdmin.isSuperAdmin ? 'Super Administrator' : 'Limited Admin'}
                  </span>
                </div>
              </div>
              <button className="modal-close" onClick={closeViewModal}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Account Status</h3>
                <div className={`status-pill large ${viewingAdmin.isActive ? 'pill-active' : 'pill-inactive'}`}>
                  <span className="status-dot"></span>
                  {viewingAdmin.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="detail-section">
                <h3>Access Permissions</h3>
                {viewingAdmin.isSuperAdmin ? (
                  <div className="access-full-detail">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Full access to all sections</span>
                  </div>
                ) : viewingAdmin.allowedSections.length === 0 ? (
                  <div className="no-access-detail">No sections assigned</div>
                ) : (
                  <div className="sections-grid">
                    {viewingAdmin.allowedSections.map(section => (
                      <div key={section} className="section-item">
                        {SECTION_INFO[section]?.icon}
                        <span>{SECTION_INFO[section]?.label || section}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(viewingAdmin.allowedSections.includes('adsense') || viewingAdmin.isSuperAdmin) && (
                <>
                  {viewingAdmin.adsenseAllowedDomains.length > 0 && (
                    <div className="detail-section">
                      <h3>Allowed Domains & Deductions</h3>
                      <div className="domain-deductions-detail">
                        {viewingAdmin.adsenseAllowedDomains.map(domain => {
                          const pct = (viewingAdmin.adsenseDomainDeductions || {})[domain] ?? 0;
                          return (
                            <div key={domain} className="domain-deduction-badge">
                              <span className="badge-domain">{domain}</span>
                              <span className={`badge-pct ${pct > 0 ? 'has-deduction' : ''}`}>
                                {pct > 0 ? `${pct}% deduction` : 'No deduction'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {(viewingAdmin.webAppLinks?.length ?? 0) > 0 && (
                <div className="detail-section">
                  <h3>Web/App Links</h3>
                  <div className="tags-list">
                    {viewingAdmin.webAppLinks.map((link, i) => (
                      <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="tag" style={{ textDecoration: 'none' }}>
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Activity</h3>
                <div className="activity-info">
                  <div className="activity-item">
                    <span className="activity-label">Created</span>
                    <span className="activity-value">{viewingAdmin.createdAt ? formatDate(viewingAdmin.createdAt) : 'Unknown'}</span>
                  </div>
                  <div className="activity-item">
                    <span className="activity-label">Last Login</span>
                    <span className="activity-value">{viewingAdmin.lastLogin ? formatDate(viewingAdmin.lastLogin) : 'Never'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeViewModal}>Close</button>
              <button
                className="btn-primary"
                onClick={() => {
                  closeViewModal();
                  handleEdit(viewingAdmin);
                }}
                disabled={viewingAdmin.isSuperAdmin && viewingAdmin.id !== adminData?.id}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Deduction Modal */}
      {showDeductionModal && (
        <div className="modal-overlay" onClick={() => setShowDeductionModal(false)}>
          <div className="deduction-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="deduction-modal-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2>Platform Deduction</h2>
                  <span className="modal-subtitle">Global revenue deduction before user shares</span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowDeductionModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {deductionLoading ? (
                <div className="loading-inline">
                  <div className="loading-spinner small"></div>
                  <span>Loading current setting...</span>
                </div>
              ) : (
                <>
                  <p className="deduction-description">
                    This percentage is silently deducted from actual earnings before applying each user&apos;s revenue share. Users will not see this deduction.
                  </p>
                  <div className="form-group">
                    <label>Deduction Percentage</label>
                    <div className="revenue-control">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={deductionPercent}
                        onChange={e => setDeductionPercent(Number(e.target.value))}
                        className="revenue-slider deduction-slider"
                        style={{ '--value': `${deductionPercent}%` } as React.CSSProperties}
                      />
                      <div className="deduction-input-wrapper">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={deductionPercent}
                          onChange={e => {
                            const v = Number(e.target.value);
                            setDeductionPercent(Math.max(0, Math.min(100, isNaN(v) ? 0 : v)));
                          }}
                          className="revenue-input"
                        />
                        <span className="revenue-suffix">%</span>
                      </div>
                    </div>
                  </div>
                  {deductionPercent > 0 && (
                    <div className="deduction-example">
                      <strong>{deductionPercent}% deduction:</strong> $100 actual &rarr; ${(100 * (1 - deductionPercent / 100)).toFixed(2)} before user share
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeductionModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveDeduction}
                disabled={deductionSaving || deductionLoading}
              >
                {deductionSaving ? (
                  <>
                    <div className="btn-spinner"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
