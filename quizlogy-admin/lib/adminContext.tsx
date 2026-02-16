'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from './api';

// Admin data interface
export interface AdminData {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  allowedSections: string[];
  adsenseAllowedDomains: string[];
  adsenseAllowedCountries: string[];
  adsenseRevenueShare: number;
  adsenseInHandRevenue: number;
  webAppLinks: Array<{label: string; url: string}>;
  createdAt: string; // ISO date string
}

// Sidebar section keys
export const SIDEBAR_SECTIONS = [
  'dashboard',
  'categories',
  'contests',
  'battles',
  'question-bank',
  'funfacts',
  'users',
  'contact-messages',
  'visitors',
  'analytics',
  'adsense',
  'gallery',
] as const;

export type SidebarSection = typeof SIDEBAR_SECTIONS[number];

interface AdminContextType {
  isAdmin: boolean;
  loading: boolean;
  adminData: AdminData | null;
  login: (username: string, password: string) => Promise<AdminData | null>;
  logout: () => Promise<void>;
  checkStatus: () => Promise<void>;
  canAccess: (section: SidebarSection) => boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const router = useRouter();
  const hasChecked = useRef(false);
  const isChecking = useRef(false);

  const checkStatus = useCallback(async () => {
    // Don't check if already checked or currently checking
    if (hasChecked.current || isChecking.current) {
      return;
    }

    // Don't check on login page
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/login') {
      setLoading(false);
      return;
    }

    isChecking.current = true;
    try {
      const response = await adminApi.checkStatus();
      setIsAdmin(response.isAdmin);
      setAdminData(response.adminData || null);
    } catch (error) {
      setIsAdmin(false);
      setAdminData(null);
    } finally {
      setLoading(false);
      hasChecked.current = true;
      isChecking.current = false;
    }
  }, []);

  useEffect(() => {
    // Only check status once on mount, and only if not on login page
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/login') {
      setLoading(false);
    } else {
      checkStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const login = useCallback(async (username: string, password: string): Promise<AdminData | null> => {
    const response = await adminApi.login(username, password);
    const data = response.adminData || null;
    setIsAdmin(true);
    setAdminData(data);
    setLoading(false);
    hasChecked.current = true; // Mark as checked after successful login
    isChecking.current = false;
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.logout();
      setIsAdmin(false);
      setAdminData(null);
      hasChecked.current = false; // Reset check flag
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [router]);

  // Check if admin can access a specific section
  const canAccess = useCallback((section: SidebarSection): boolean => {
    if (!adminData) return false;

    // Super admin has access to everything
    if (adminData.isSuperAdmin) return true;

    // Check if section is in allowed sections
    return adminData.allowedSections.includes(section);
  }, [adminData]);

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        loading,
        adminData,
        login,
        logout,
        checkStatus: checkStatus,
        canAccess,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
