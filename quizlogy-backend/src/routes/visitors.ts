import express, { Request, Response } from 'express';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import prisma from '../config/database';

const router = express.Router();

// Get all visitors with filtering (admin only)
router.get('/', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      search,
      country,
      region,
      deviceType,
      os,
      browser,
      dateFrom,
      dateTo,
      sortBy = 'lastVisit',
      sortOrder = 'desc',
    } = req.query;
    // Support both "origins" (comma-separated or single) and "origins[]" (array from some clients)
    const originsParam = req.query.origins ?? req.query['origins[]'];

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { ipAddress: { contains: search as string, mode: 'insensitive' } },
        { country: { contains: search as string, mode: 'insensitive' } },
        { lastVisitedPage: { contains: search as string, mode: 'insensitive' } },
        { origin: { contains: search as string, mode: 'insensitive' } },
        { referer: { contains: search as string, mode: 'insensitive' } },
        { exitPage: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (country) {
      where.country = country as string;
    }

    if (region) {
      where.region = region as string;
    }

    if (deviceType) {
      where.deviceType = deviceType as string;
    }

    if (os) {
      where.os = { contains: os as string, mode: 'insensitive' };
    }

    if (browser) {
      where.browser = { contains: browser as string, mode: 'insensitive' };
    }

    // Date range filter on lastVisit
    if (dateFrom || dateTo) {
      where.lastVisit = {};
      if (dateFrom) {
        where.lastVisit.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        // Include the entire "dateTo" day by setting time to end of day
        const endDate = new Date(dateTo as string);
        endDate.setHours(23, 59, 59, 999);
        where.lastVisit.lte = endDate;
      }
    }

    // Multiple origins filter: comma-separated or array (e.g. "Direct,https://a.com" or ["Direct","https://a.com"])
    const originsRaw = originsParam;
    const originsList = Array.isArray(originsRaw)
      ? (originsRaw as string[])
      : typeof originsRaw === 'string' && originsRaw
        ? originsRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    if (originsList.length > 0) {
      const directCondition = originsList.includes('Direct')
        ? [{ origin: null }, { origin: '' }]
        : [];
      const urlConditions = originsList
        .filter((o) => o !== 'Direct')
        .map((o) => ({ origin: o }));
      const originOr = [...directCondition, ...urlConditions];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: originOr }];
        delete where.OR;
      } else {
        where.OR = originOr;
      }
    }

    // Get total count
    const total = await prisma.visitorIP.count({ where });

    // Get visitors
    const visitors = await prisma.visitorIP.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc',
      },
    });

    res.json({
      status: true,
      data: visitors,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching visitors:', error);
    res.status(500).json({ error: 'Failed to fetch visitors' });
  }
});

// Get visitor statistics (admin only)
router.get('/stats', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const totalVisitors = await prisma.visitorIP.count();
    const totalVisits = await prisma.visitorIP.aggregate({
      _sum: {
        visitCount: true,
      },
    });
    const totalClicks = await prisma.visitorIP.aggregate({
      _sum: {
        clickCount: true,
      },
    });

    // Get unique countries
    const countries = await prisma.visitorIP.findMany({
      select: {
        country: true,
      },
      distinct: ['country'],
    });

    res.json({
      status: true,
      totalVisitors,
      totalVisits: totalVisits._sum.visitCount || 0,
      totalClicks: totalClicks._sum.clickCount || 0,
      uniqueCountries: countries.filter(c => c.country).length,
    });
  } catch (error) {
    console.error('Error fetching visitor stats:', error);
    res.status(500).json({ error: 'Failed to fetch visitor stats' });
  }
});

// Get unique countries list (admin only)
router.get('/countries', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const visitors = await prisma.visitorIP.findMany({
      select: {
        country: true,
        countryCode: true,
      },
      distinct: ['country'],
      where: {
        country: {
          not: null,
        },
      },
      orderBy: {
        country: 'asc',
      },
    });

    const countriesList = visitors
      .filter(v => v.country)
      .map(v => ({
        country: v.country!,
        countryCode: v.countryCode || v.country!,
      }));

    res.json({
      status: true,
      countries: countriesList,
    });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Get traffic source analytics (admin only)
router.get('/traffic-sources', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    // Get visitors grouped by origin (include null/empty as "Direct")
    const originGroups = await prisma.visitorIP.groupBy({
      by: ['origin'],
      _count: {
        origin: true,
      },
      orderBy: {
        _count: {
          origin: 'desc',
        },
      },
    });

    // Get visitors grouped by referer
    const refererGroups = await prisma.visitorIP.groupBy({
      by: ['referer'],
      _count: {
        referer: true,
      },
      where: {
        referer: {
          not: null,
        },
      },
      orderBy: {
        _count: {
          referer: 'desc',
        },
      },
      take: 50, // Top 50 referers
    });

    // Detect webview vs normal browser
    const allVisitors = await prisma.visitorIP.findMany({
      select: {
        userAgent: true,
      },
    });

    let webviewCount = 0;
    let normalBrowserCount = 0;

    allVisitors.forEach(visitor => {
      if (visitor.userAgent) {
        const ua = visitor.userAgent.toLowerCase();
        // Check for webview indicators
        if (ua.includes('wv') || 
            ua.includes('webview') || 
            ua.includes('android.*wv') ||
            ua.includes('version/') && !ua.includes('chrome')) {
          webviewCount++;
        } else {
          normalBrowserCount++;
        }
      }
    });

    res.json({
      status: true,
      trafficSources: {
        byOrigin: originGroups.map(item => ({
          origin: item.origin || 'Direct',
          visitorCount: item._count.origin,
        })),
        byReferer: refererGroups.map(item => ({
          referer: item.referer || 'Direct',
          visitorCount: item._count.referer,
        })),
        browserType: {
          webview: webviewCount,
          normalBrowser: normalBrowserCount,
          unknown: allVisitors.length - webviewCount - normalBrowserCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching traffic sources:', error);
    res.status(500).json({ error: 'Failed to fetch traffic sources' });
  }
});

// Export visitors to CSV (admin only)
router.get('/export', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const visitors = await prisma.visitorIP.findMany({
      orderBy: {
        lastVisit: 'desc',
      },
    });

    // CSV headers
    const headers = [
      'IP Address',
      'Country',
      'Country Code',
      'Region',
      'Device Type',
      'OS',
      'Browser',
      'Screen Resolution',
      'Visit Count',
      'Click Count',
      'Session Clicks',
      'Last Visited Page',
      'Exit Page',
      'First Visit',
      'Last Visit',
      'CF-Connecting-IP',
      'CF-IP-Country',
      'Origin',
      'Referer',
      'User-Agent',
      'X-Real-IP',
      'X-Requested-With',
      'Sec-CH-UA-Platform',
      'Time Stamp',
    ];

    // Convert to CSV rows
    const csvRows = [
      headers.join(','),
      ...visitors.map(v => {
        const row = [
          `"${v.ipAddress || ''}"`,
          `"${v.country || ''}"`,
          `"${v.countryCode || ''}"`,
          `"${v.region || ''}"`,
          `"${v.deviceType || ''}"`,
          `"${(v.os || '').replace(/"/g, '""')}"`,
          `"${(v.browser || '').replace(/"/g, '""')}"`,
          `"${v.screenResolution || ''}"`,
          v.visitCount || 0,
          v.clickCount || 0,
          v.lastSessionClicks || 0,
          `"${(v.lastVisitedPage || '').replace(/"/g, '""')}"`,
          `"${(v.exitPage || '').replace(/"/g, '""')}"`,
          `"${v.firstVisit ? new Date(v.firstVisit).toISOString() : ''}"`,
          `"${v.lastVisit ? new Date(v.lastVisit).toISOString() : ''}"`,
          `"${v.cfConnectingIp || ''}"`,
          `"${v.cfIpCountry || ''}"`,
          `"${(v.origin || '').replace(/"/g, '""')}"`,
          `"${(v.referer || '').replace(/"/g, '""')}"`,
          `"${(v.userAgent || '').replace(/"/g, '""')}"`,
          `"${v.xRealIp || ''}"`,
          `"${v.xRequestedWith || ''}"`,
          `"${(v.secChUaPlatform || '').replace(/"/g, '""')}"`,
          `"${v.timeStamp ? new Date(v.timeStamp).toISOString() : ''}"`,
        ];
        return row.join(',');
      }),
    ];

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="visitors_export_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting visitors:', error);
    res.status(500).json({ error: 'Failed to export visitors' });
  }
});

// Delete a specific visitor IP (admin only)
router.delete('/:ipAddress', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { ipAddress } = req.params;
    
    // Decode the IP address (it might be URL encoded)
    const decodedIp = decodeURIComponent(ipAddress);
    
    const deleted = await prisma.visitorIP.delete({
      where: { ipAddress: decodedIp },
    });
    
    res.json({
      status: true,
      message: 'Visitor IP deleted successfully',
      data: deleted,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      // Record not found
      res.status(404).json({ error: 'Visitor IP not found' });
    } else {
      console.error('Error deleting visitor IP:', error);
      res.status(500).json({ error: 'Failed to delete visitor IP' });
    }
  }
});

// Clear all visitor data (admin only)
router.delete('/', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const result = await prisma.visitorIP.deleteMany({});
    
    res.json({
      status: true,
      message: `Successfully deleted ${result.count} visitor records`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Error clearing visitor data:', error);
    res.status(500).json({ error: 'Failed to clear visitor data' });
  }
});

// Get full analytics with filters (date range, country, origin) - Google Analytics style
router.get('/analytics/full', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { startDate, endDate, countries, origins } = req.query;
    const countriesList = typeof countries === 'string' && countries
      ? countries.split(',').map(s => s.trim()).filter(Boolean) : [];
    const originsList = typeof origins === 'string' && origins
      ? origins.split(',').map(s => s.trim()).filter(Boolean) : [];

    const where: any = {};

    // Date range filter - endDate includes full day (23:59:59.999)
    if (startDate && endDate) {
      const start = new Date((startDate as string) + 'T00:00:00');
      const end = new Date((endDate as string) + 'T23:59:59.999');
      where.lastVisit = { gte: start, lte: end };
    } else if (startDate) {
      where.lastVisit = { gte: new Date((startDate as string) + 'T00:00:00') };
    } else if (endDate) {
      where.lastVisit = { lte: new Date((endDate as string) + 'T23:59:59.999') };
    }

    // Country filter
    if (countriesList.length > 0) {
      where.country = { in: countriesList };
    }

    // Origin filter
    if (originsList.length > 0) {
      const directIncluded = originsList.includes('Direct');
      const originConditions = directIncluded
        ? [{ origin: null }, { origin: '' }, ...originsList.filter(o => o !== 'Direct').map(o => ({ origin: o }))]
        : originsList.filter(o => o !== 'Direct').map(o => ({ origin: o }));
      if (originConditions.length > 0) {
        where.OR = originConditions;
      }
    }

    // If we have both date and other filters, wrap in AND
    const finalWhere = Object.keys(where).length === 0 ? undefined : where;

    const visitors = await prisma.visitorIP.findMany({
      where: finalWhere,
      select: {
        origin: true, referer: true, userAgent: true, xRequestedWith: true,
        visitCount: true, clickCount: true, firstVisit: true, lastVisit: true,
        deviceType: true, os: true, browser: true, country: true,
      },
    });

    const totalUsers = visitors.length;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newUsers = visitors.filter(v => v.firstVisit && new Date(v.firstVisit) >= thirtyDaysAgo).length;
    const activeUsers = totalUsers;

    const totalVisits = visitors.reduce((s, v) => s + (v.visitCount || 0), 0);
    const totalClicks = visitors.reduce((s, v) => s + (v.clickCount || 0), 0);
    const bouncedVisitors = visitors.filter(v => (v.visitCount || 0) <= 1 && (v.clickCount || 0) <= 1).length;
    const bounceRate = totalUsers > 0 ? (bouncedVisitors / totalUsers) * 100 : 0;
    const avgSessionDuration = totalVisits > 0 ? Math.round((totalClicks / totalVisits) * 45) : 0; // proxy: ~45s per "engagement unit"
    const avgPageViews = totalVisits > 0 ? (totalClicks / totalVisits) : 0;
    const viewsPerSession = totalVisits > 0 ? (totalClicks / totalVisits) : 0;

    // Browser distribution (by name, no version) - Chrome 120 & Chrome 121 = same
    const normalizeBrowser = (name: string): string => {
      const n = (name || 'Unknown').trim() || 'Unknown';
      // Strip version: "Chrome 120" -> "Chrome", "Firefox 121.0" -> "Firefox"
      const match = n.match(/^([A-Za-z\s]+?)(?:\s+[\d\.]+)?$/);
      return match ? match[1].trim() : n;
    };
    const browserCounts: Record<string, number> = {};
    visitors.forEach(v => {
      const b = normalizeBrowser(v.browser || 'Unknown');
      browserCounts[b] = (browserCounts[b] || 0) + 1;
    });
    const browserDistribution = Object.entries(browserCounts)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count);

    // Device distribution
    const deviceCounts: Record<string, number> = { mobile: 0, tablet: 0, desktop: 0, unknown: 0 };
    visitors.forEach(v => {
      const d = (v.deviceType || 'unknown').toLowerCase();
      if (d === 'mobile' || d === 'tablet' || d === 'desktop') deviceCounts[d]++;
      else deviceCounts.unknown++;
    });
    const deviceDistribution = [
      { device: 'mobile', count: deviceCounts.mobile },
      { device: 'tablet', count: deviceCounts.tablet },
      { device: 'desktop', count: deviceCounts.desktop },
      { device: 'unknown', count: deviceCounts.unknown },
    ].filter(d => d.count > 0).sort((a, b) => b.count - a.count);

    // OS distribution - descending
    const osCounts: Record<string, number> = {};
    visitors.forEach(v => {
      const o = (v.os || 'Unknown').trim() || 'Unknown';
      osCounts[o] = (osCounts[o] || 0) + 1;
    });
    const osDistribution = Object.entries(osCounts)
      .map(([os, count]) => ({ os, count }))
      .sort((a, b) => b.count - a.count);

    // Table: hostname, device category, total users, new users, bounce rate, avg session, total users %
    const extractHostname = (url: string | null) => {
      if (!url) return 'Direct';
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    };

    const tableMap: Record<string, { hostname: string; deviceCategory: string; totalUsers: number; newUsers: number; bounced: number; totalClicks: number; totalVisits: number }> = {};
    visitors.forEach(v => {
      const host = extractHostname(v.origin || v.referer);
      const device = (v.deviceType || 'unknown').toLowerCase();
      const key = `${host}|${device}`;
      if (!tableMap[key]) {
        tableMap[key] = { hostname: host, deviceCategory: device, totalUsers: 0, newUsers: 0, bounced: 0, totalClicks: 0, totalVisits: 0 };
      }
      tableMap[key].totalUsers++;
      if (v.firstVisit && new Date(v.firstVisit) >= thirtyDaysAgo) tableMap[key].newUsers++;
      if ((v.visitCount || 0) <= 1 && (v.clickCount || 0) <= 1) tableMap[key].bounced++;
      tableMap[key].totalClicks += v.clickCount || 0;
      tableMap[key].totalVisits += v.visitCount || 0;
    });

    const tableData = Object.values(tableMap).map(row => {
      const bouncePct = row.totalUsers > 0 ? (row.bounced / row.totalUsers) * 100 : 0;
      const avgSess = row.totalVisits > 0 ? Math.round((row.totalClicks / row.totalVisits) * 45) : 0;
      const pctTotal = totalUsers > 0 ? (row.totalUsers / totalUsers) * 100 : 0;
      return {
        hostname: row.hostname,
        deviceCategory: row.deviceCategory,
        totalUsers: row.totalUsers,
        newUsers: row.newUsers,
        bounceRate: bouncePct,
        avgSessionDuration: avgSess,
        totalUsersPercent: pctTotal,
      };
    }).sort((a, b) => b.totalUsers - a.totalUsers);

    res.json({
      status: true,
      data: {
        newUsers,
        activeUsers,
        totalUsers,
        bounceRate,
        avgSessionDuration,
        avgPageViews,
        viewsPerSession,
        browserDistribution,
        deviceDistribution,
        osDistribution,
        tableData,
      },
    });
  } catch (error) {
    console.error('Error fetching full analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get analytics data with time filter (admin only)
router.get('/analytics', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { timeFilter = '24h' } = req.query;
    
    // Calculate date range based on filter
    const now = new Date();
    let startDate: Date | null = null;
    
    switch (timeFilter) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '10d':
        startDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = null;
    }
    
    // Build where clause
    const where: any = startDate ? { lastVisit: { gte: startDate } } : {};
    
    // Get all visitors within time range
    const visitors = await prisma.visitorIP.findMany({
      where,
      select: {
        origin: true,
        referer: true,
        userAgent: true,
        xRequestedWith: true,
      },
    });
    
    const totalVisitors = visitors.length;
    
    // Count by origin
    const originCounts: Record<string, number> = {};
    visitors.forEach(v => {
      const origin = v.origin || 'Direct';
      originCounts[origin] = (originCounts[origin] || 0) + 1;
    });
    
    const byOrigin = Object.entries(originCounts)
      .map(([source, count]) => ({
        source,
        count,
        percentage: totalVisitors > 0 ? (count / totalVisitors) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
    
    // Count by referer
    const refererCounts: Record<string, number> = {};
    visitors.forEach(v => {
      const referer = v.referer || 'Direct';
      refererCounts[referer] = (refererCounts[referer] || 0) + 1;
    });
    
    const byReferer = Object.entries(refererCounts)
      .map(([source, count]) => ({
        source,
        count,
        percentage: totalVisitors > 0 ? (count / totalVisitors) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
    
    // Extract subdomain from origin/referer
    const subdomainCounts: Record<string, number> = {};
    visitors.forEach(v => {
      let subdomain = 'Direct';
      const url = v.origin || v.referer;
      if (url) {
        try {
          const urlObj = new URL(url);
          const hostname = urlObj.hostname;
          // Extract subdomain (everything before the main domain)
          const parts = hostname.split('.');
          if (parts.length > 2) {
            subdomain = parts.slice(0, -2).join('.');
          } else {
            subdomain = hostname;
          }
        } catch {
          subdomain = url;
        }
      }
      subdomainCounts[subdomain] = (subdomainCounts[subdomain] || 0) + 1;
    });
    
    const bySubdomain = Object.entries(subdomainCounts)
      .map(([source, count]) => ({
        source,
        count,
        percentage: totalVisitors > 0 ? (count / totalVisitors) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
    
    // Detect browser type (webview vs normal)
    let webviewCount = 0;
    let normalBrowserCount = 0;
    let unknownCount = 0;
    
    visitors.forEach(v => {
      const ua = (v.userAgent || '').toLowerCase();
      const xRequested = (v.xRequestedWith || '').toLowerCase();
      
      // Webview detection patterns
      const isWebview = 
        xRequested.includes('com.') || // Android webview
        ua.includes('wv') || // Android WebView
        ua.includes('webview') ||
        ua.includes('fbav') || // Facebook App
        ua.includes('fban') ||
        ua.includes('instagram') ||
        ua.includes('twitter') ||
        ua.includes('linkedin') ||
        ua.includes('snapchat') ||
        ua.includes('telegram') ||
        ua.includes('whatsapp') ||
        (ua.includes('mobile') && !ua.includes('safari') && ua.includes('applewebkit'));
      
      if (!ua) {
        unknownCount++;
      } else if (isWebview) {
        webviewCount++;
      } else {
        normalBrowserCount++;
      }
    });
    
    res.json({
      status: true,
      data: {
        byOrigin,
        byReferer,
        bySubdomain,
        browserType: {
          webview: webviewCount,
          normalBrowser: normalBrowserCount,
          unknown: unknownCount,
        },
        totalVisitors,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;

