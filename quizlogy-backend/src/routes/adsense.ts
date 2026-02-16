import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import path from 'path';
import { isAdmin, AdminRequest, AdminData } from '../middleware/adminAuth';
import { invoiceUpload } from '../middleware/upload';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_ADSENSE_CLIENT_ID,
  process.env.GOOGLE_ADSENSE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_ADSENSE_REFRESH_TOKEN,
});

const adsense = google.adsense({ version: 'v2', auth: oauth2Client });
const accountId = process.env.GOOGLE_ADSENSE_ACCOUNT_ID || '';

// In-memory cache with 1-hour TTL (for account info, ad units, etc.)
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 60 * 60 * 1000;

// Track last sync time
let lastSyncTime: Date | null = null;
let isSyncing = false;

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// Helper: format date as YYYY-MM-DD
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Fetch data from Google AdSense API
async function fetchFromApi(startDate: string, endDate: string): Promise<any[]> {
  const response = await adsense.accounts.reports.generate({
    account: accountId,
    'startDate.year': parseInt(startDate.split('-')[0]),
    'startDate.month': parseInt(startDate.split('-')[1]),
    'startDate.day': parseInt(startDate.split('-')[2]),
    'endDate.year': parseInt(endDate.split('-')[0]),
    'endDate.month': parseInt(endDate.split('-')[1]),
    'endDate.day': parseInt(endDate.split('-')[2]),
    dimensions: ['DATE', 'COUNTRY_NAME', 'DOMAIN_NAME'],
    metrics: [
      'ESTIMATED_EARNINGS',
      'PAGE_VIEWS',
      'PAGE_VIEWS_RPM',
      'IMPRESSIONS',
      'IMPRESSIONS_RPM',
      'CLICKS',
    ],
    reportingTimeZone: 'ACCOUNT_TIME_ZONE',
  });

  const headers = response.data.headers || [];
  return (response.data.rows || []).map((row: any) => {
    const cells = row.cells || [];
    const obj: any = {};
    headers.forEach((header: any, i: number) => {
      const val = cells[i]?.value || '0';
      obj[header.name || `col_${i}`] = header.type === 'DIMENSION' ? val : parseFloat(val);
    });
    return obj;
  });
}

// Save rows to database
async function saveRowsToDb(rows: any[]): Promise<number> {
  let savedCount = 0;
  for (const row of rows) {
    try {
      await prisma.adsenseData.upsert({
        where: {
          date_domainName_countryName: {
            date: row.DATE || '',
            domainName: row.DOMAIN_NAME || '',
            countryName: row.COUNTRY_NAME || '',
          },
        },
        update: {
          pageViews: row.PAGE_VIEWS || 0,
          pageViewsRpm: row.PAGE_VIEWS_RPM || 0,
          impressions: row.IMPRESSIONS || 0,
          impressionsRpm: row.IMPRESSIONS_RPM || 0,
          clicks: row.CLICKS || 0,
          earnings: row.ESTIMATED_EARNINGS || 0,
          updatedAt: new Date(),
        },
        create: {
          date: row.DATE || '',
          domainName: row.DOMAIN_NAME || '',
          countryName: row.COUNTRY_NAME || '',
          pageViews: row.PAGE_VIEWS || 0,
          pageViewsRpm: row.PAGE_VIEWS_RPM || 0,
          impressions: row.IMPRESSIONS || 0,
          impressionsRpm: row.IMPRESSIONS_RPM || 0,
          clicks: row.CLICKS || 0,
          earnings: row.ESTIMATED_EARNINGS || 0,
        },
      });
      savedCount++;
    } catch (err) {
      console.error('Error saving adsense row:', err);
    }
  }
  return savedCount;
}

// Background sync function
async function performSync(syncType: 'auto' | 'manual' = 'auto'): Promise<void> {
  if (isSyncing) {
    console.log('AdSense sync already in progress, skipping...');
    return;
  }

  isSyncing = true;
  const today = formatDate(new Date());
  const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  try {
    console.log(`[AdSense] Starting ${syncType} sync for ${thirtyDaysAgo} to ${today}`);

    const rows = await fetchFromApi(thirtyDaysAgo, today);
    const savedCount = await saveRowsToDb(rows);

    lastSyncTime = new Date();

    // Log the sync
    await prisma.adsenseSyncLog.create({
      data: {
        syncType,
        startDate: thirtyDaysAgo,
        endDate: today,
        rowsCount: savedCount,
        status: 'success',
      },
    });

    console.log(`[AdSense] Sync completed: ${savedCount} rows saved`);
  } catch (err: any) {
    console.error('[AdSense] Sync error:', err.message);

    // Log the error
    await prisma.adsenseSyncLog.create({
      data: {
        syncType,
        startDate: thirtyDaysAgo,
        endDate: today,
        rowsCount: 0,
        status: 'error',
        errorMsg: err.message,
      },
    });
  } finally {
    isSyncing = false;
  }
}

// Start hourly sync
function startHourlySync(): void {
  // Initial sync on startup
  performSync('auto');

  // Schedule hourly sync
  setInterval(() => {
    performSync('auto');
  }, 60 * 60 * 1000); // Every hour

  console.log('[AdSense] Hourly sync scheduler started');
}

// Start the scheduler
startHourlySync();

// ==================== GLOBAL DEDUCTION CACHE ====================

let cachedDeductPercent: number = 0;
let deductCacheExpiry: number = 0;
const DEDUCT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getGlobalDeductPercent(): Promise<number> {
  if (Date.now() < deductCacheExpiry) return cachedDeductPercent;
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'global' } });
    cachedDeductPercent = settings?.revenueDeductPercent ?? 0;
  } catch {
    // If table doesn't exist yet, default to 0
    cachedDeductPercent = 0;
  }
  deductCacheExpiry = Date.now() + DEDUCT_CACHE_TTL;
  return cachedDeductPercent;
}

// ==================== ADMIN FILTERING HELPERS ====================

function applyRevenueShare(value: number, sharePercent: number, deductPercent: number): number {
  if (value <= 0) return 0;
  const afterDeduction = value * (1 - deductPercent / 100);
  return Math.max(0, afterDeduction * (sharePercent / 100));
}

function applyDomainDeduction(value: number, domainName: string, globalDeductPct: number, domainDeductions: Record<string, number>): number {
  if (value <= 0) return 0;
  const afterGlobal = value * (1 - globalDeductPct / 100);
  const domainPct = domainDeductions[domainName] ?? 0;
  return Math.max(0, afterGlobal * (1 - domainPct / 100));
}

async function filterRowsForAdmin(rows: any[], adminData?: AdminData): Promise<any[]> {
  if (!adminData || adminData.isSuperAdmin) {
    return rows;
  }

  const { adsenseAllowedDomains, adsenseAllowedCountries, adsenseRevenueShare } = adminData;
  const domainDeductions = adminData.adsenseDomainDeductions || {};
  const hasDomainDeductions = Object.keys(domainDeductions).length > 0;
  const deductPercent = await getGlobalDeductPercent();

  return rows
    .filter(row => {
      if (adsenseAllowedDomains.length > 0) {
        const domain = row.DOMAIN_NAME || row.domainName || '';
        if (!adsenseAllowedDomains.some(d => domain.includes(d))) {
          return false;
        }
      }
      if (adsenseAllowedCountries.length > 0) {
        const country = row.COUNTRY_NAME || row.countryName || '';
        if (!adsenseAllowedCountries.includes(country)) {
          return false;
        }
      }
      return true;
    })
    .map(row => {
      const earnings = row.ESTIMATED_EARNINGS || row.earnings || 0;
      const domain = row.DOMAIN_NAME || row.domainName || '';

      let adjusted: number;
      if (hasDomainDeductions) {
        adjusted = applyDomainDeduction(earnings, domain, deductPercent, domainDeductions);
      } else {
        adjusted = applyRevenueShare(earnings, adsenseRevenueShare, deductPercent);
      }

      return {
        ...row,
        ESTIMATED_EARNINGS: adjusted,
        earnings: row.earnings !== undefined ? adjusted : undefined,
      };
    });
}

async function applySummaryRevenueShare(summary: any, adminData?: AdminData): Promise<any> {
  if (!adminData || adminData.isSuperAdmin) {
    return summary;
  }

  const { adsenseRevenueShare } = adminData;
  const domainDeductions = adminData.adsenseDomainDeductions || {};
  const hasDomainDeductions = Object.keys(domainDeductions).length > 0;
  const deductPercent = await getGlobalDeductPercent();

  let earningsValue = summary.earnings?.value || 0;
  if (hasDomainDeductions) {
    // For aggregate summary, use average domain deduction as approximation
    const pcts = Object.values(domainDeductions);
    const avgDomainPct = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
    const afterGlobal = earningsValue * (1 - deductPercent / 100);
    earningsValue = Math.max(0, afterGlobal * (1 - avgDomainPct / 100));
  } else {
    earningsValue = applyRevenueShare(earningsValue, adsenseRevenueShare, deductPercent);
  }

  return {
    ...summary,
    earnings: summary.earnings
      ? {
          ...summary.earnings,
          value: earningsValue,
        }
      : summary.earnings,
  };
}

// ==================== API ROUTES ====================

// GET /admin-summary - Per-admin AdSense totals (super admin only)
router.get('/admin-summary', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    if (!req.adminData?.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin only' });
    }

    // 1. Get all non-super-admin users
    const admins = await prisma.adminUser.findMany({
      where: { isSuperAdmin: false },
      select: {
        id: true,
        username: true,
        adsenseAllowedDomains: true,
        adsenseAllowedCountries: true,
        adsenseRevenueShare: true,
        adsenseDomainDeductions: true,
        isActive: true,
      },
    });

    // 2. Get last 30 days of adsense data
    const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const today = formatDate(new Date());
    const dbRows = await prisma.adsenseData.findMany({
      where: { date: { gte: thirtyDaysAgo, lte: today } },
    });

    // 3. Transform rows to filterable format
    const rows = dbRows.map(row => ({
      DATE: row.date,
      DOMAIN_NAME: row.domainName,
      COUNTRY_NAME: row.countryName,
      ESTIMATED_EARNINGS: row.earnings,
      IMPRESSIONS: row.impressions,
      IMPRESSIONS_RPM: row.impressionsRpm,
    }));

    // 4. For each admin, filter and sum
    const result = await Promise.all(admins.map(async admin => {
      let allowedDomains: string[] = [];
      let allowedCountries: string[] = [];
      let domainDeductions: Record<string, number> = {};
      try { allowedDomains = JSON.parse(admin.adsenseAllowedDomains || '[]'); } catch {}
      try { allowedCountries = JSON.parse(admin.adsenseAllowedCountries || '[]'); } catch {}
      try { domainDeductions = JSON.parse(admin.adsenseDomainDeductions || '{}'); } catch {}

      const adminData: AdminData = {
        id: admin.id,
        username: admin.username,
        isSuperAdmin: false,
        adsenseAllowedDomains: allowedDomains,
        adsenseAllowedCountries: allowedCountries,
        adsenseRevenueShare: admin.adsenseRevenueShare,
        adsenseDomainDeductions: domainDeductions,
        adsenseInHandRevenue: 0,
        allowedSections: [],
        webAppLinks: [],
        createdAt: '',
      };

      const filtered = await filterRowsForAdmin(rows, adminData);
      const totalEarnings = filtered.reduce((sum, r) => sum + (r.ESTIMATED_EARNINGS || 0), 0);
      const totalImpressions = filtered.reduce((sum, r) => sum + (r.IMPRESSIONS || 0), 0);
      const totalImpressionsRpm = filtered.reduce((sum, r) => sum + (r.IMPRESSIONS_RPM || 0), 0);
      const avgImpressionsRpm = filtered.length > 0 ? totalImpressionsRpm / filtered.length : 0;

      return {
        adminId: admin.id,
        username: admin.username,
        earnings: totalEarnings,
        impressions: totalImpressions,
        impressionsRpm: avgImpressionsRpm,
        domains: allowedDomains,
        isActive: admin.isActive,
      };
    }));

    res.json({ status: true, data: result });
  } catch (error: any) {
    console.error('Admin summary error:', error.message);
    res.status(500).json({ error: 'Failed to fetch admin summary', details: error.message });
  }
});

// GET /sync-status - Get last sync time and status
router.get('/sync-status', isAdmin, async (_req: Request, res: Response) => {
  try {
    const lastLog = await prisma.adsenseSyncLog.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      lastSyncTime: lastSyncTime?.toISOString() || lastLog?.createdAt?.toISOString() || null,
      isSyncing,
      lastSyncStatus: lastLog?.status || null,
      lastSyncRows: lastLog?.rowsCount || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get sync status', details: error.message });
  }
});

// POST /sync - Trigger manual sync
router.post('/sync', isAdmin, async (_req: Request, res: Response) => {
  try {
    if (isSyncing) {
      return res.status(409).json({ error: 'Sync already in progress' });
    }

    // Run sync in background
    performSync('manual');

    res.json({ message: 'Sync started', isSyncing: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to start sync', details: error.message });
  }
});

// GET /account - Account info
router.get('/account', isAdmin, async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'adsense_account';
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const response = await adsense.accounts.get({ name: accountId });
    const account = response.data;

    const result = {
      name: account.displayName || account.name,
      publisherId: account.name,
      state: account.state,
      timeZone: account.timeZone,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error: any) {
    console.error('AdSense account error:', error.message);
    res.status(500).json({ error: 'Failed to fetch AdSense account', details: error.message });
  }
});

// GET /report/detailed - Get detailed report from database
router.get('/report/detailed', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const startDate = (req.query.startDate as string) || formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endDate = (req.query.endDate as string) || formatDate(new Date());

    // Fetch from database
    const dbRows = await prisma.adsenseData.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Transform to API format
    const rows = dbRows.map(row => ({
      DATE: row.date,
      DOMAIN_NAME: row.domainName,
      COUNTRY_NAME: row.countryName,
      PAGE_VIEWS: row.pageViews,
      PAGE_VIEWS_RPM: row.pageViewsRpm,
      IMPRESSIONS: row.impressions,
      IMPRESSIONS_RPM: row.impressionsRpm,
      CLICKS: row.clicks,
      ESTIMATED_EARNINGS: row.earnings,
    }));

    // Apply admin filtering
    const filteredRows = await filterRowsForAdmin(rows, req.adminData);

    // Calculate totals and aggregates
    const domainsSet = new Set<string>();
    const countriesSet = new Set<string>();
    let totalEarnings = 0;
    let totalPageViews = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalPageViewsRpm = 0;
    let totalImpressionsRpm = 0;

    filteredRows.forEach((row: any) => {
      if (row.DOMAIN_NAME) domainsSet.add(row.DOMAIN_NAME);
      if (row.COUNTRY_NAME) countriesSet.add(row.COUNTRY_NAME);
      totalEarnings += row.ESTIMATED_EARNINGS || 0;
      totalPageViews += row.PAGE_VIEWS || 0;
      totalImpressions += row.IMPRESSIONS || 0;
      totalClicks += row.CLICKS || 0;
      totalPageViewsRpm += row.PAGE_VIEWS_RPM || 0;
      totalImpressionsRpm += row.IMPRESSIONS_RPM || 0;
    });

    const rowCount = filteredRows.length || 1;

    // Get last sync time
    const lastLog = await prisma.adsenseSyncLog.findFirst({
      where: { status: 'success' },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      rows: filteredRows,
      domains: Array.from(domainsSet).sort(),
      countries: Array.from(countriesSet).sort(),
      totals: {
        earnings: totalEarnings,
        pageViews: totalPageViews,
        impressions: totalImpressions,
        clicks: totalClicks,
        avgPageViewsRpm: totalPageViewsRpm / rowCount,
        avgImpressionsRpm: totalImpressionsRpm / rowCount,
      },
      lastFetched: lastLog?.createdAt?.toISOString() || lastSyncTime?.toISOString() || new Date().toISOString(),
      complete: true,
    });
  } catch (error: any) {
    console.error('AdSense detailed report error:', error.message);
    res.status(500).json({ error: 'Failed to fetch detailed report', details: error.message });
  }
});

// GET /report/summary - Dashboard summary cards
router.get('/report/summary', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || '30d';
    const cacheKey = `adsense_summary_${period}`;
    const cached = getCached(cacheKey);

    if (cached) {
      return res.json(await applySummaryRevenueShare(cached, req.adminData));
    }

    const { startDate, endDate, prevStartDate, prevEndDate } = getDateRange(period);

    const metrics = [
      'ESTIMATED_EARNINGS',
      'PAGE_VIEWS',
      'CLICKS',
      'IMPRESSIONS',
      'PAGE_VIEWS_CTR',
      'PAGE_VIEWS_RPM',
    ];

    const [currentRes, prevRes] = await Promise.all([
      adsense.accounts.reports.generate({
        account: accountId,
        'startDate.year': parseInt(startDate.split('-')[0]),
        'startDate.month': parseInt(startDate.split('-')[1]),
        'startDate.day': parseInt(startDate.split('-')[2]),
        'endDate.year': parseInt(endDate.split('-')[0]),
        'endDate.month': parseInt(endDate.split('-')[1]),
        'endDate.day': parseInt(endDate.split('-')[2]),
        metrics,
        reportingTimeZone: 'ACCOUNT_TIME_ZONE',
      }),
      adsense.accounts.reports.generate({
        account: accountId,
        'startDate.year': parseInt(prevStartDate.split('-')[0]),
        'startDate.month': parseInt(prevStartDate.split('-')[1]),
        'startDate.day': parseInt(prevStartDate.split('-')[2]),
        'endDate.year': parseInt(prevEndDate.split('-')[0]),
        'endDate.month': parseInt(prevEndDate.split('-')[1]),
        'endDate.day': parseInt(prevEndDate.split('-')[2]),
        metrics,
        reportingTimeZone: 'ACCOUNT_TIME_ZONE',
      }),
    ]);

    const extractTotals = (data: any) => {
      const totals = data.totals?.cells || [];
      const headers = data.headers || [];
      const obj: any = {};
      headers.forEach((h: any, i: number) => {
        obj[h.name] = parseFloat(totals[i]?.value || '0');
      });
      return obj;
    };

    const current = extractTotals(currentRes.data);
    const previous = extractTotals(prevRes.data);

    const calcDelta = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    const result = {
      period,
      startDate,
      endDate,
      earnings: { value: current.ESTIMATED_EARNINGS || 0, delta: calcDelta(current.ESTIMATED_EARNINGS || 0, previous.ESTIMATED_EARNINGS || 0) },
      pageViews: { value: current.PAGE_VIEWS || 0, delta: calcDelta(current.PAGE_VIEWS || 0, previous.PAGE_VIEWS || 0) },
      clicks: { value: current.CLICKS || 0, delta: calcDelta(current.CLICKS || 0, previous.CLICKS || 0) },
      impressions: { value: current.IMPRESSIONS || 0, delta: calcDelta(current.IMPRESSIONS || 0, previous.IMPRESSIONS || 0) },
      ctr: { value: current.PAGE_VIEWS_CTR || 0, delta: calcDelta(current.PAGE_VIEWS_CTR || 0, previous.PAGE_VIEWS_CTR || 0) },
      rpm: { value: current.PAGE_VIEWS_RPM || 0, delta: calcDelta(current.PAGE_VIEWS_RPM || 0, previous.PAGE_VIEWS_RPM || 0) },
    };

    setCache(cacheKey, result);
    res.json(await applySummaryRevenueShare(result, req.adminData));
  } catch (error: any) {
    console.error('AdSense summary error:', error.message);
    res.status(500).json({ error: 'Failed to fetch AdSense summary', details: error.message });
  }
});

// Helper: get date range from period string
function getDateRange(period: string): { startDate: string; endDate: string; prevStartDate: string; prevEndDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  switch (period) {
    case 'today':
      startDate = today;
      prevStartDate = new Date(today);
      prevStartDate.setDate(prevStartDate.getDate() - 1);
      prevEndDate = new Date(prevStartDate);
      break;
    case '7d':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - 6);
      break;
    case 'thisMonth':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      prevStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      break;
    case '30d':
    default:
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 29);
      prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - 29);
      break;
  }

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(today),
    prevStartDate: formatDate(prevStartDate),
    prevEndDate: formatDate(prevEndDate),
  };
}

// GET /adunits - List all ad units with 30-day performance
router.get('/adunits', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const cacheKey = 'adsense_adunits';
    const cached = getCached(cacheKey);

    if (cached) {
      const filteredUnits = await filterRowsForAdmin(cached, req.adminData);
      return res.json(filteredUnits);
    }

    const adClientsRes = await adsense.accounts.adclients.list({
      parent: accountId,
    }).catch(() => ({ data: { adClients: [] } }));

    const adClients = (adClientsRes.data as any).adClients || [];

    let allUnits: any[] = [];
    for (const client of adClients) {
      const unitsRes = await adsense.accounts.adclients.adunits.list({
        parent: client.name,
      }).catch(() => ({ data: { adUnits: [] } }));
      allUnits = allUnits.concat((unitsRes.data as any).adUnits || []);
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let reportRows: any[] = [];
    let reportHeaders: any[] = [];
    try {
      const reportRes = await adsense.accounts.reports.generate({
        account: accountId,
        'startDate.year': thirtyDaysAgo.getFullYear(),
        'startDate.month': thirtyDaysAgo.getMonth() + 1,
        'startDate.day': thirtyDaysAgo.getDate(),
        'endDate.year': now.getFullYear(),
        'endDate.month': now.getMonth() + 1,
        'endDate.day': now.getDate(),
        dimensions: ['AD_UNIT_NAME'],
        metrics: ['ESTIMATED_EARNINGS', 'CLICKS', 'IMPRESSIONS', 'PAGE_VIEWS_CTR'],
        reportingTimeZone: 'ACCOUNT_TIME_ZONE',
      });
      reportHeaders = reportRes.data.headers || [];
      reportRows = reportRes.data.rows || [];
    } catch {
      try {
        const reportRes = await adsense.accounts.reports.generate({
          account: accountId,
          'startDate.year': thirtyDaysAgo.getFullYear(),
          'startDate.month': thirtyDaysAgo.getMonth() + 1,
          'startDate.day': thirtyDaysAgo.getDate(),
          'endDate.year': now.getFullYear(),
          'endDate.month': now.getMonth() + 1,
          'endDate.day': now.getDate(),
          dimensions: ['AD_UNIT_ID'],
          metrics: ['ESTIMATED_EARNINGS', 'CLICKS', 'IMPRESSIONS', 'PAGE_VIEWS_CTR'],
          reportingTimeZone: 'ACCOUNT_TIME_ZONE',
        });
        reportHeaders = reportRes.data.headers || [];
        reportRows = reportRes.data.rows || [];
      } catch {
        // No ad unit breakdown available
      }
    }

    const perfMap = new Map<string, any>();
    reportRows.forEach((row: any) => {
      const cells = row.cells || [];
      const obj: any = {};
      reportHeaders.forEach((h: any, i: number) => {
        obj[h.name] = h.type === 'DIMENSION' ? cells[i]?.value : parseFloat(cells[i]?.value || '0');
      });
      const key = obj.AD_UNIT_NAME || obj.AD_UNIT_ID || '';
      perfMap.set(key, obj);
    });

    const finalResult = allUnits.length > 0
      ? allUnits.map((unit: any) => {
          const perf = perfMap.get(unit.displayName || unit.name) || perfMap.get(unit.name) || {};
          return {
            name: unit.displayName || unit.name,
            type: unit.contentAdsSettings?.type || 'DISPLAY',
            state: unit.state || 'ACTIVE',
            earnings: perf.ESTIMATED_EARNINGS || 0,
            clicks: perf.CLICKS || 0,
            impressions: perf.IMPRESSIONS || 0,
            ctr: perf.PAGE_VIEWS_CTR || 0,
          };
        })
      : reportRows.map((row: any) => {
          const cells = row.cells || [];
          const obj: any = {};
          reportHeaders.forEach((h: any, i: number) => {
            obj[h.name] = h.type === 'DIMENSION' ? cells[i]?.value : parseFloat(cells[i]?.value || '0');
          });
          return {
            name: obj.AD_UNIT_NAME || obj.AD_UNIT_ID || 'Unknown',
            type: 'DISPLAY',
            state: 'ACTIVE',
            earnings: obj.ESTIMATED_EARNINGS || 0,
            clicks: obj.CLICKS || 0,
            impressions: obj.IMPRESSIONS || 0,
            ctr: obj.PAGE_VIEWS_CTR || 0,
          };
        });

    setCache(cacheKey, finalResult);
    const filteredUnits = await filterRowsForAdmin(finalResult, req.adminData);
    res.json(filteredUnits);
  } catch (error: any) {
    console.error('AdSense adunits error:', error.message);
    res.status(500).json({ error: 'Failed to fetch ad units', details: error.message });
  }
});

// GET /payments - Payment history
router.get('/payments', isAdmin, async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'adsense_payments';
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const response = await adsense.accounts.payments.list({
      parent: accountId,
    });

    const payments = (response.data.payments || []).map((p: any) => ({
      date: p.date ? `${p.date.year}-${String(p.date.month).padStart(2, '0')}-${String(p.date.day).padStart(2, '0')}` : 'Pending',
      amount: p.amount ? `${p.amount.currencyCode} ${(parseInt(p.amount.units || '0') + (p.amount.nanos || 0) / 1e9).toFixed(2)}` : 'N/A',
    }));

    setCache(cacheKey, payments);
    res.json(payments);
  } catch (error: any) {
    console.error('AdSense payments error:', error.message);
    res.status(500).json({ error: 'Failed to fetch payments', details: error.message });
  }
});

// GET /sites - Verified sites list
router.get('/sites', isAdmin, async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'adsense_sites';
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const response = await adsense.accounts.sites.list({
      parent: accountId,
    });

    const sites = (response.data.sites || []).map((s: any) => ({
      domain: s.domain,
      state: s.state,
      autoAdsEnabled: s.autoAdsEnabled || false,
    }));

    setCache(cacheKey, sites);
    res.json(sites);
  } catch (error: any) {
    console.error('AdSense sites error:', error.message);
    res.status(500).json({ error: 'Failed to fetch sites', details: error.message });
  }
});

// GET /domains - Get list of all domains from database
router.get('/domains', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const domains = await prisma.adsenseData.findMany({
      select: { domainName: true },
      distinct: ['domainName'],
    });

    res.json({
      status: true,
      domains: domains.map(d => d.domainName).sort(),
    });
  } catch (error: any) {
    console.error('AdSense domains error:', error.message);
    res.status(500).json({ error: 'Failed to fetch domains', details: error.message });
  }
});

// GET /countries - Get list of all countries from database
router.get('/countries', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const countries = await prisma.adsenseData.findMany({
      select: { countryName: true },
      distinct: ['countryName'],
    });

    res.json({
      status: true,
      countries: countries.map(c => c.countryName).sort(),
    });
  } catch (error: any) {
    console.error('AdSense countries error:', error.message);
    res.status(500).json({ error: 'Failed to fetch countries', details: error.message });
  }
});

// ==================== MONTHLY EARNINGS (No Google API) ====================

// GET /monthly-earnings - Get monthly earnings from local DB for the logged-in admin
router.get('/monthly-earnings', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const adminData = req.adminData;

    // Get all adsense data from DB
    const dbRows = await prisma.adsenseData.findMany({
      orderBy: { date: 'desc' },
    });

    // Transform and apply admin filtering
    const rows = dbRows.map(row => ({
      DATE: row.date,
      DOMAIN_NAME: row.domainName,
      COUNTRY_NAME: row.countryName,
      earnings: row.earnings,
    }));

    const filteredRows = await filterRowsForAdmin(rows, adminData);

    // Group by month (YYYY-MM)
    const monthlyMap = new Map<string, number>();
    for (const row of filteredRows) {
      if (!row.DATE) continue;
      const monthKey = row.DATE.substring(0, 7); // "YYYY-MM"
      const current = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, current + (row.earnings || 0));
    }

    // Convert to sorted array (newest first)
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const monthly = Array.from(monthlyMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, earnings]) => {
        const [year, month] = monthKey.split('-');
        const monthName = monthNames[parseInt(month) - 1];
        return {
          monthKey,
          monthName: `${monthName}-${year}`,
          earnings: parseFloat(earnings.toFixed(2)),
        };
      });

    // Get invoice requests for this admin to determine payment status
    const where: any = {};
    if (adminData && !adminData.isSuperAdmin) {
      where.adminId = adminData.id;
    }
    const invoiceRequests = await prisma.invoiceRequest.findMany({ where });
    const invoiceMap = new Map<string, any>();
    for (const inv of invoiceRequests) {
      invoiceMap.set(inv.monthKey, inv);
    }

    // Merge invoice status with monthly data
    const result = monthly.map(m => {
      const invoice = invoiceMap.get(m.monthKey);
      return {
        ...m,
        status: invoice?.status || 'none', // 'none', 'pending', 'approved', 'rejected'
        invoiceId: invoice?.id || null,
      };
    });

    // Calculate total carryforward (months with no approved invoice)
    const carryforward = result
      .filter(m => m.status !== 'approved')
      .reduce((sum, m) => sum + m.earnings, 0);

    res.json({
      status: true,
      data: result,
      carryforward: parseFloat(carryforward.toFixed(2)),
      revenueShare: adminData?.adsenseRevenueShare || 100,
    });
  } catch (error: any) {
    console.error('Error fetching monthly earnings:', error);
    res.status(500).json({ error: 'Failed to fetch monthly earnings', details: error.message });
  }
});

// ==================== INVOICE REQUEST ROUTES ====================

// GET /invoices/approved - Get approved invoice requests (for Payment History)
router.get('/invoices/approved', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const adminData = req.adminData;
    const where: any = { status: 'approved' };

    // Non-super admins can only see their own approved invoices
    if (adminData && !adminData.isSuperAdmin) {
      where.adminId = adminData.id;
    }

    const invoices = await prisma.invoiceRequest.findMany({
      where,
      orderBy: { processedAt: 'desc' },
    });

    res.json({
      status: true,
      data: invoices,
    });
  } catch (error: any) {
    console.error('Error fetching approved invoices:', error);
    res.status(500).json({ error: 'Failed to fetch approved invoices', details: error.message });
  }
});

// GET /invoices/file/:id - Serve uploaded invoice file
router.get('/invoices/file/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const adminData = req.adminData;
    const { id } = req.params;

    const invoice = await prisma.invoiceRequest.findUnique({ where: { id } });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice request not found' });
    }

    // Non-super admins can only access their own files
    if (adminData && !adminData.isSuperAdmin && invoice.adminId !== adminData.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!invoice.filePath) {
      return res.status(404).json({ error: 'No file attached to this invoice' });
    }

    const absolutePath = path.resolve(process.cwd(), invoice.filePath);
    res.sendFile(absolutePath);
  } catch (error: any) {
    console.error('Error serving invoice file:', error);
    res.status(500).json({ error: 'Failed to serve invoice file', details: error.message });
  }
});

// GET /invoices - Get invoice requests for admin (own invoices) or all (super admin)
router.get('/invoices', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const adminData = req.adminData;
    const where: any = {};

    // Non-super admins can only see their own invoices
    if (adminData && !adminData.isSuperAdmin) {
      where.adminId = adminData.id;
    }

    const invoices = await prisma.invoiceRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
    });

    res.json({
      status: true,
      data: invoices,
    });
  } catch (error: any) {
    console.error('Error fetching invoice requests:', error);
    res.status(500).json({ error: 'Failed to fetch invoice requests', details: error.message });
  }
});

// POST /invoices - Create a new invoice request (with optional file upload)
router.post('/invoices', isAdmin, invoiceUpload.single('file'), async (req: AdminRequest, res: Response) => {
  try {
    const adminData = req.adminData;
    if (!adminData) {
      return res.status(401).json({ error: 'Admin data not found' });
    }

    const {
      monthKey,
      monthName,
      carryforward,
      grossEarnings,
      deductions,
      netEarnings,
      totalUSD,
      totalINR,
    } = req.body;

    if (!monthKey || !monthName) {
      return res.status(400).json({ error: 'monthKey and monthName are required' });
    }

    // Check if invoice request already exists
    const existing = await prisma.invoiceRequest.findUnique({
      where: {
        adminId_monthKey: {
          adminId: adminData.id,
          monthKey,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Invoice request already exists for this month' });
    }

    // Get file path if uploaded
    const filePath = req.file ? `uploads/invoices/${req.file.filename}` : null;

    // Create the invoice request
    const invoice = await prisma.invoiceRequest.create({
      data: {
        adminId: adminData.id,
        adminUsername: adminData.username,
        monthKey,
        monthName,
        carryforward: parseFloat(carryforward) || 0,
        grossEarnings: parseFloat(grossEarnings) || 0,
        deductions: parseFloat(deductions) || 0,
        netEarnings: parseFloat(netEarnings) || 0,
        totalUSD: parseFloat(totalUSD) || 0,
        totalINR: parseFloat(totalINR) || 0,
        status: 'pending',
        filePath,
      },
    });

    res.status(201).json({
      status: true,
      data: invoice,
    });
  } catch (error: any) {
    console.error('Error creating invoice request:', error);
    res.status(500).json({ error: 'Failed to create invoice request', details: error.message });
  }
});

// PUT /invoices/:id - Update invoice status (super admin only)
router.put('/invoices/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const adminData = req.adminData;
    if (!adminData?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admin can update invoice status' });
    }

    const { id } = req.params;
    const { status, rejectionNote } = req.body;

    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, approved, or rejected' });
    }

    const invoice = await prisma.invoiceRequest.update({
      where: { id },
      data: {
        status,
        rejectionNote: status === 'rejected' ? rejectionNote : null,
        processedAt: status !== 'pending' ? new Date() : null,
        processedBy: status !== 'pending' ? adminData.username : null,
      },
    });

    res.json({
      status: true,
      data: invoice,
    });
  } catch (error: any) {
    console.error('Error updating invoice request:', error);
    res.status(500).json({ error: 'Failed to update invoice request', details: error.message });
  }
});

// DELETE /invoices/:id - Delete an invoice request (admin can delete own pending, super admin can delete any)
router.delete('/invoices/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const adminData = req.adminData;
    const { id } = req.params;

    const invoice = await prisma.invoiceRequest.findUnique({ where: { id } });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice request not found' });
    }

    // Check permissions
    if (!adminData?.isSuperAdmin) {
      if (invoice.adminId !== adminData?.id) {
        return res.status(403).json({ error: 'You can only delete your own invoice requests' });
      }
      if (invoice.status !== 'pending') {
        return res.status(403).json({ error: 'You can only delete pending invoice requests' });
      }
    }

    await prisma.invoiceRequest.delete({ where: { id } });

    res.json({
      status: true,
      message: 'Invoice request deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting invoice request:', error);
    res.status(500).json({ error: 'Failed to delete invoice request', details: error.message });
  }
});

// GET /overview - Overview page data (5 periods from local DB)
router.get('/overview', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = formatDate(today);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    // Day before yesterday (comparison for yesterday)
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const dayBeforeYesterdayStr = formatDate(dayBeforeYesterday);

    // Last 7 days
    const last7Start = new Date(today);
    last7Start.setDate(last7Start.getDate() - 6);
    const last7StartStr = formatDate(last7Start);

    // Previous 7 days (for comparison)
    const prev7End = new Date(last7Start);
    prev7End.setDate(prev7End.getDate() - 1);
    const prev7Start = new Date(prev7End);
    prev7Start.setDate(prev7Start.getDate() - 6);
    const prev7StartStr = formatDate(prev7Start);
    const prev7EndStr = formatDate(prev7End);

    // This month
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthStartStr = formatDate(thisMonthStart);

    // Same period last month (for comparison with thisMonth)
    const prevMonthSameStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const dayOfMonth = today.getDate();
    const prevMonthSameEnd = new Date(today.getFullYear(), today.getMonth() - 1, dayOfMonth);
    const prevMonthSameStartStr = formatDate(prevMonthSameStart);
    const prevMonthSameEndStr = formatDate(prevMonthSameEnd);

    // Last month (full)
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const lastMonthStartStr = formatDate(lastMonthStart);
    const lastMonthEndStr = formatDate(lastMonthEnd);

    // Month before last (full, for comparison)
    const monthBeforeLastStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const monthBeforeLastEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
    const monthBeforeLastStartStr = formatDate(monthBeforeLastStart);
    const monthBeforeLastEndStr = formatDate(monthBeforeLastEnd);

    // Query all periods in parallel
    const [
      todayRows,
      yesterdayRows,
      dayBeforeYesterdayRows,
      last7Rows,
      prev7Rows,
      thisMonthRows,
      prevMonthSameRows,
      lastMonthRows,
      monthBeforeLastRows,
    ] = await Promise.all([
      prisma.adsenseData.findMany({ where: { date: todayStr } }),
      prisma.adsenseData.findMany({ where: { date: yesterdayStr } }),
      prisma.adsenseData.findMany({ where: { date: dayBeforeYesterdayStr } }),
      prisma.adsenseData.findMany({ where: { date: { gte: last7StartStr, lte: todayStr } } }),
      prisma.adsenseData.findMany({ where: { date: { gte: prev7StartStr, lte: prev7EndStr } } }),
      prisma.adsenseData.findMany({ where: { date: { gte: thisMonthStartStr, lte: todayStr } } }),
      prisma.adsenseData.findMany({ where: { date: { gte: prevMonthSameStartStr, lte: prevMonthSameEndStr } } }),
      prisma.adsenseData.findMany({ where: { date: { gte: lastMonthStartStr, lte: lastMonthEndStr } } }),
      prisma.adsenseData.findMany({ where: { date: { gte: monthBeforeLastStartStr, lte: monthBeforeLastEndStr } } }),
    ]);

    // Transform DB rows to filterable format
    const toRows = (dbRows: any[]) => dbRows.map(row => ({
      DATE: row.date,
      DOMAIN_NAME: row.domainName,
      COUNTRY_NAME: row.countryName,
      earnings: row.earnings,
      pageViews: row.pageViews || 0,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
    }));

    // Apply admin filtering to all sets
    const [
      fToday, fYesterday, fDayBefore,
      fLast7, fPrev7,
      fThisMonth, fPrevMonthSame,
      fLastMonth, fMonthBeforeLast,
    ] = await Promise.all([
      filterRowsForAdmin(toRows(todayRows), req.adminData),
      filterRowsForAdmin(toRows(yesterdayRows), req.adminData),
      filterRowsForAdmin(toRows(dayBeforeYesterdayRows), req.adminData),
      filterRowsForAdmin(toRows(last7Rows), req.adminData),
      filterRowsForAdmin(toRows(prev7Rows), req.adminData),
      filterRowsForAdmin(toRows(thisMonthRows), req.adminData),
      filterRowsForAdmin(toRows(prevMonthSameRows), req.adminData),
      filterRowsForAdmin(toRows(lastMonthRows), req.adminData),
      filterRowsForAdmin(toRows(monthBeforeLastRows), req.adminData),
    ]);

    // Sum fields
    const sumEarnings = (rows: any[]) => rows.reduce((sum, r) => sum + (r.earnings || 0), 0);
    const sumField = (rows: any[], field: string) => rows.reduce((sum, r) => sum + (r[field] || 0), 0);

    const calcDelta = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    const todayEarnings = sumEarnings(fToday);
    const yesterdayEarnings = sumEarnings(fYesterday);
    const dayBeforeEarnings = sumEarnings(fDayBefore);
    const last7Earnings = sumEarnings(fLast7);
    const prev7Earnings = sumEarnings(fPrev7);
    const thisMonthEarnings = sumEarnings(fThisMonth);
    const prevMonthSameEarnings = sumEarnings(fPrevMonthSame);
    const lastMonthEarnings = sumEarnings(fLastMonth);
    const monthBeforeLastEarnings = sumEarnings(fMonthBeforeLast);

    // Get last sync time
    const lastLog = await prisma.adsenseSyncLog.findFirst({
      where: { status: 'success' },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      today: {
        earnings: todayEarnings, delta: calcDelta(todayEarnings, yesterdayEarnings),
        pageViews: sumField(fToday, 'pageViews'), impressions: sumField(fToday, 'impressions'), clicks: sumField(fToday, 'clicks'),
      },
      yesterday: {
        earnings: yesterdayEarnings, delta: calcDelta(yesterdayEarnings, dayBeforeEarnings),
        pageViews: sumField(fYesterday, 'pageViews'), impressions: sumField(fYesterday, 'impressions'), clicks: sumField(fYesterday, 'clicks'),
      },
      last7Days: {
        earnings: last7Earnings, delta: calcDelta(last7Earnings, prev7Earnings),
        pageViews: sumField(fLast7, 'pageViews'), impressions: sumField(fLast7, 'impressions'), clicks: sumField(fLast7, 'clicks'),
      },
      thisMonth: {
        earnings: thisMonthEarnings, delta: calcDelta(thisMonthEarnings, prevMonthSameEarnings),
        pageViews: sumField(fThisMonth, 'pageViews'), impressions: sumField(fThisMonth, 'impressions'), clicks: sumField(fThisMonth, 'clicks'),
      },
      lastMonth: {
        earnings: lastMonthEarnings, delta: calcDelta(lastMonthEarnings, monthBeforeLastEarnings),
        pageViews: sumField(fLastMonth, 'pageViews'), impressions: sumField(fLastMonth, 'impressions'), clicks: sumField(fLastMonth, 'clicks'),
      },
      lastSynced: lastLog?.createdAt?.toISOString() || lastSyncTime?.toISOString() || null,
    });
  } catch (error: any) {
    console.error('AdSense overview error:', error.message);
    res.status(500).json({ error: 'Failed to fetch overview data', details: error.message });
  }
});

// GET /export - Export data as CSV
router.get('/export', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const startDate = (req.query.startDate as string) || formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endDate = (req.query.endDate as string) || formatDate(new Date());

    const dbRows = await prisma.adsenseData.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Transform and filter
    const rows = dbRows.map(row => ({
      DATE: row.date,
      DOMAIN_NAME: row.domainName,
      COUNTRY_NAME: row.countryName,
      PAGE_VIEWS: row.pageViews,
      PAGE_VIEWS_RPM: row.pageViewsRpm,
      IMPRESSIONS: row.impressions,
      IMPRESSIONS_RPM: row.impressionsRpm,
      CLICKS: row.clicks,
      ESTIMATED_EARNINGS: row.earnings,
    }));

    const filteredRows = await filterRowsForAdmin(rows, req.adminData);

    // Generate CSV
    const headers = ['Date', 'Domain', 'Country', 'Page Views', 'Page RPM', 'Impressions', 'Imp. RPM', 'Clicks', 'Earnings'];
    const csvRows = [
      headers.join(','),
      ...filteredRows.map(row => [
        row.DATE,
        `"${row.DOMAIN_NAME}"`,
        `"${row.COUNTRY_NAME}"`,
        row.PAGE_VIEWS,
        row.PAGE_VIEWS_RPM.toFixed(2),
        row.IMPRESSIONS,
        row.IMPRESSIONS_RPM.toFixed(2),
        row.CLICKS,
        row.ESTIMATED_EARNINGS.toFixed(2),
      ].join(',')),
    ];

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="adsense-report-${startDate}-to-${endDate}.csv"`);
    res.send(csv);
  } catch (error: any) {
    console.error('AdSense export error:', error.message);
    res.status(500).json({ error: 'Failed to export data', details: error.message });
  }
});

export default router;
