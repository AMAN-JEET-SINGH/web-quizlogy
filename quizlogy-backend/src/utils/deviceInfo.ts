import { Request } from 'express';

export interface DeviceInfo {
  deviceType?: string;
  os?: string;
  browser?: string;
  screenResolution?: string;
}

// Parse User-Agent to extract device info
export function parseUserAgent(userAgent: string | undefined): DeviceInfo {
  if (!userAgent) {
    return {};
  }

  const ua = userAgent.toLowerCase();
  const info: DeviceInfo = {};

  // Detect device type
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(userAgent)) {
    info.deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
    info.deviceType = 'mobile';
  } else {
    info.deviceType = 'desktop';
  }

  // Detect OS
  if (ua.includes('windows')) {
    if (ua.includes('windows nt 10')) {
      info.os = 'Windows 10/11';
    } else if (ua.includes('windows nt 6.3')) {
      info.os = 'Windows 8.1';
    } else if (ua.includes('windows nt 6.2')) {
      info.os = 'Windows 8';
    } else if (ua.includes('windows nt 6.1')) {
      info.os = 'Windows 7';
    } else {
      info.os = 'Windows';
    }
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    info.os = 'macOS';
  } else if (ua.includes('linux')) {
    info.os = 'Linux';
  } else if (ua.includes('android')) {
    const androidVersion = userAgent.match(/android\s([0-9\.]*)/i);
    info.os = androidVersion ? `Android ${androidVersion[1]}` : 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    const iosVersion = userAgent.match(/os\s([0-9_]*)/i);
    info.os = iosVersion ? `iOS ${iosVersion[1].replace(/_/g, '.')}` : 'iOS';
  } else if (ua.includes('ubuntu')) {
    info.os = 'Ubuntu';
  } else if (ua.includes('fedora')) {
    info.os = 'Fedora';
  }

  // Detect browser (name only - no version, so Chrome 120 and Chrome 121 count as same)
  if (ua.includes('edg')) {
    info.browser = 'Edge';
  } else if (ua.includes('chrome') && !ua.includes('edg')) {
    info.browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    info.browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    info.browser = 'Safari';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    info.browser = 'Opera';
  } else if (ua.includes('msie') || ua.includes('trident')) {
    info.browser = 'Internet Explorer';
  } else if (ua.includes('samsung')) {
    info.browser = 'Samsung Internet';
  } else if (ua.includes('android') && ua.includes('wv')) {
    info.browser = 'Android WebView';
  }

  return info;
}

// Extract device info from request
export function getDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.headers['user-agent'];
  const deviceInfo = parseUserAgent(userAgent);

  // Screen resolution comes from frontend, not headers
  // We'll get it from the tracking API endpoint
  return deviceInfo;
}

