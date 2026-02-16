import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import geoip from 'geoip-lite';
import { getDeviceInfo, DeviceInfo } from '../utils/deviceInfo';

// Helper function to get client IP address
export function getClientIP(req: Request): string {
  // Check for IP in various headers (for proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (forwarded as string).split(',');
    return ips[0].trim();
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP as string;
  }
  
  // Fallback to connection remote address
  return req.socket.remoteAddress || req.ip || 'unknown';
}

// Helper function to get country code from IP
export function getCountryFromIP(ip: string): { country?: string; countryCode?: string; region?: string } {
  try {
    // Skip localhost and private IPs
    if (ip === 'unknown' || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return { country: 'Unknown', countryCode: 'UN', region: 'ALL' };
    }

    const geo = geoip.lookup(ip);
    if (!geo) {
      return { country: 'Unknown', countryCode: 'UN', region: 'ALL' };
    }

    // Determine region: "IND" for India, "ALL" for others
    const region = geo.country === 'IN' ? 'IND' : 'ALL';

    return {
      country: geo.country,
      countryCode: geo.country,
      region,
    };
  } catch (error) {
    console.error('Error getting country from IP:', error);
    return { country: 'Unknown', countryCode: 'UN', region: 'ALL' };
  }
}

// Session timeout: 30 minutes of inactivity = new session
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Routes to skip tracking (admin routes)
const SKIP_TRACKING_PATHS = [
  '/api/admin',
  '/api/visitors',
  '/api/upload',
  '/health',
  '/api/test',
];

// Admin frontend origins to skip
const ADMIN_ORIGINS = [
  'localhost:3001',
  '127.0.0.1:3001',
  'admin.',  // Any admin subdomain
];

// Middleware to track IP and update visitor information
export async function trackVisitorIP(req: Request, res: Response, next: NextFunction) {
  try {
    const ip = getClientIP(req);
    
    // Skip tracking for unknown IPs
    if (ip === 'unknown') {
      return next();
    }
    
    // Skip tracking for admin routes
    const currentPath = req.path || req.url || '';
    const shouldSkipPath = SKIP_TRACKING_PATHS.some(skipPath => 
      currentPath.startsWith(skipPath)
    );
    if (shouldSkipPath) {
      return next();
    }
    
    // Skip tracking for admin frontend requests
    const origin = req.headers['origin'] as string || '';
    const referer = req.headers['referer'] as string || '';
    const isAdminRequest = ADMIN_ORIGINS.some(adminOrigin => 
      origin.includes(adminOrigin) || referer.includes(adminOrigin)
    );
    if (isAdminRequest) {
      return next();
    }

    // Get geolocation info
    const geoInfo = getCountryFromIP(ip);

    // Get device info from User-Agent
    const deviceInfo = getDeviceInfo(req);

    // Get current page path
    const currentPage = req.path || req.url;
    const now = new Date();
    
    // Extract headers for tracking
    const headers = {
      cfConnectingIp: req.headers['cf-connecting-ip'] as string | undefined,
      cfIpCountry: req.headers['cf-ipcountry'] as string | undefined,
      origin: req.headers['origin'] as string | undefined,
      referer: req.headers['referer'] as string | undefined,
      secChUa: req.headers['sec-ch-ua'] as string | undefined,
      secChUaFullVersionList: req.headers['sec-ch-ua-full-version-list'] as string | undefined,
      secChUaPlatform: req.headers['sec-ch-ua-platform'] as string | undefined,
      userAgent: req.headers['user-agent'] as string | undefined,
      xRealIp: req.headers['x-real-ip'] as string | undefined,
      xRequestedWith: req.headers['x-requested-with'] as string | undefined,
    };

    // Check if visitor exists
    const existingVisitor = await prisma.visitorIP.findUnique({
      where: { ipAddress: ip },
    });

    if (existingVisitor) {
      // Check if this is a new session
      // A new session is when:
      // 1. No lastSessionStart exists (first time tracking sessions)
      // 2. Last visit was more than SESSION_TIMEOUT_MS ago
      const isNewSession = !existingVisitor.lastSessionStart || 
        (existingVisitor.lastVisit && 
         (now.getTime() - existingVisitor.lastVisit.getTime()) > SESSION_TIMEOUT_MS);

      const updateData: any = {
        lastVisitedPage: currentPage,
        lastVisit: now,
        timeStamp: now,
        // Update country info if not set or if changed
        ...(geoInfo.country && {
          country: geoInfo.country,
          countryCode: geoInfo.countryCode,
          region: geoInfo.region,
        }),
        // Update device info if not set or if changed
        ...(deviceInfo.deviceType && { deviceType: deviceInfo.deviceType }),
        ...(deviceInfo.os && { os: deviceInfo.os }),
        ...(deviceInfo.browser && { browser: deviceInfo.browser }),
        // ALWAYS update header tracking fields (even if undefined/null)
        cfConnectingIp: headers.cfConnectingIp || null,
        cfIpCountry: headers.cfIpCountry || null,
        origin: headers.origin || null,
        referer: headers.referer || null,
        secChUa: headers.secChUa || null,
        secChUaFullVersionList: headers.secChUaFullVersionList || null,
        secChUaPlatform: headers.secChUaPlatform || null,
        userAgent: headers.userAgent || null,
        xRealIp: headers.xRealIp || null,
        xRequestedWith: headers.xRequestedWith || null,
      };

      // If it's a new session, increment visit count and reset session clicks
      if (isNewSession) {
        updateData.visitCount = existingVisitor.visitCount + 1;
        updateData.lastSessionStart = now;
        updateData.lastSessionClicks = 0; // Reset session clicks for new session
      }

      await prisma.visitorIP.update({
        where: { ipAddress: ip },
        data: updateData,
      });
    } else {
      // Create new visitor record (first visit = first session)
      await prisma.visitorIP.create({
        data: {
          ipAddress: ip,
          visitCount: 1, // First session
          clickCount: 0,
          lastSessionClicks: 0,
          lastVisitedPage: currentPage,
          country: geoInfo.country || null,
          countryCode: geoInfo.countryCode || null,
          region: geoInfo.region || null,
          deviceType: deviceInfo.deviceType || null,
          os: deviceInfo.os || null,
          browser: deviceInfo.browser || null,
          lastSessionStart: now, // Start of first session
          firstVisit: now,
          lastVisit: now,
          timeStamp: now,
          // Header tracking fields - ALWAYS store all fields
          cfConnectingIp: headers.cfConnectingIp || null,
          cfIpCountry: headers.cfIpCountry || null,
          origin: headers.origin || null,
          referer: headers.referer || null,
          secChUa: headers.secChUa || null,
          secChUaFullVersionList: headers.secChUaFullVersionList || null,
          secChUaPlatform: headers.secChUaPlatform || null,
          userAgent: headers.userAgent || null,
          xRealIp: headers.xRealIp || null,
          xRequestedWith: headers.xRequestedWith || null,
        },
      });
    }

    // Attach IP and country info to request for use in routes
    (req as any).clientIP = ip;
    (req as any).clientRegion = geoInfo.region || 'ALL'; // Legacy
    (req as any).clientCountryCode = geoInfo.countryCode || 'ALL'; // ISO code e.g. "IN", "US"

    next();
  } catch (error) {
    console.error('Error tracking visitor IP:', error);
    // Don't block the request if tracking fails
    next();
  }
}

// Function to update exit page
export async function updateExitPage(ip: string, exitPage: string) {
  try {
    if (ip === 'unknown') {
      return;
    }

    await prisma.visitorIP.update({
      where: { ipAddress: ip },
      data: {
        exitPage,
        lastVisit: new Date(),
      },
    });
  } catch (error) {
    console.error('Error updating exit page:', error);
  }
}

