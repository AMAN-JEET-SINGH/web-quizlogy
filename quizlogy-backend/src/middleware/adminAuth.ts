import { Request, Response, NextFunction } from 'express';

// Admin data interface
export interface AdminData {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  allowedSections: string[];
  adsenseAllowedDomains: string[];
  adsenseAllowedCountries: string[];
  adsenseRevenueShare: number;
  adsenseDomainDeductions: Record<string, number>;
  adsenseInHandRevenue: number;
  webAppLinks: Array<{label: string; url: string}>;
  createdAt: string; // ISO date string
}

export interface AdminRequest extends Request {
  admin?: {
    isAdmin: boolean;
  };
  adminData?: AdminData;
}

// Basic admin check middleware
export const isAdmin = (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  // Check if admin session exists
  if (req.session && (req.session as any).admin) {
    // Attach admin data if available
    if ((req.session as any).adminData) {
      req.adminData = (req.session as any).adminData;
    }
    return next();
  }
  res.status(401).json({ error: 'Unauthorized: Admin access required' });
};

// Super admin check middleware
export const isSuperAdmin = (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  // Check if admin session exists and is super admin
  if (req.session && (req.session as any).admin) {
    const adminData = (req.session as any).adminData as AdminData | undefined;
    if (adminData?.isSuperAdmin) {
      req.adminData = adminData;
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Super admin access required' });
  }
  res.status(401).json({ error: 'Unauthorized: Admin access required' });
};

// Section access check middleware factory
export const hasSection = (section: string) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (req.session && (req.session as any).admin) {
      const adminData = (req.session as any).adminData as AdminData | undefined;

      // Super admin has access to all sections
      if (adminData?.isSuperAdmin) {
        req.adminData = adminData;
        return next();
      }

      // Check if section is in allowed sections
      if (adminData?.allowedSections?.includes(section)) {
        req.adminData = adminData;
        return next();
      }

      return res.status(403).json({ error: `Forbidden: No access to ${section} section` });
    }
    res.status(401).json({ error: 'Unauthorized: Admin access required' });
  };
};

// Sidebar section keys for reference
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
