'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from './api';

interface AdminContextType {
  isAdmin: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
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
    } catch (error) {
      setIsAdmin(false);
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

  const login = useCallback(async (username: string, password: string) => {
    await adminApi.login(username, password);
    setIsAdmin(true);
    setLoading(false);
    hasChecked.current = true; // Mark as checked after successful login
    isChecking.current = false;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.logout();
      setIsAdmin(false);
      hasChecked.current = false; // Reset check flag
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [router]);

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        loading,
        login,
        logout,
        checkStatus: checkStatus,
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

