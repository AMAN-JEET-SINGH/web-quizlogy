import express, { Request, Response } from 'express';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import prisma from '../config/database';

const router = express.Router();

// Get dashboard analytics (admin only)
router.get('/', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { timeRange = '30d' } = req.query; // '1d', '7d', '30d', '1y', 'all'

    // Get registered users (users who have registered/created account)
    const registeredUsers = await prisma.user.count();

    // Get total visitors from visitor_ips table (total users who used the app)
    const totalAppUsers = await prisma.visitorIP.count();

    // Calculate unregistered users (visitors who haven't registered)
    const unregisteredUsers = Math.max(0, totalAppUsers - registeredUsers);

    // Total users = registered users (for backward compatibility)
    const totalUsers = registeredUsers;

    // Get total games (contests)
    const totalGames = await prisma.contest.count();

    // Get contest attempts (participations)
    const contestAttempted = await prisma.contestParticipation.count({
      where: {
        completedAt: {
          not: null,
        },
      },
    });

    // Calculate date range based on timeRange parameter
    let startDate: Date | null = null;
    let daysBack = 30;
    let interval: 'hour' | 'day' | 'week' | 'month' = 'day';

    const now = new Date();
    switch (timeRange) {
      case '1d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        daysBack = 1;
        interval = 'hour';
        break;
      case '7d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        daysBack = 7;
        interval = 'day';
        break;
      case '30d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        daysBack = 30;
        interval = 'day';
        break;
      case '1y':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        daysBack = 365;
        interval = 'week';
        break;
      case 'all':
        startDate = null; // All time
        interval = 'month';
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        daysBack = 30;
        interval = 'day';
    }

    // Get visitor growth data (from visitor_ips table) instead of users
    const visitorGrowthWhere: any = {};
    if (startDate) {
      visitorGrowthWhere.firstVisit = { gte: startDate };
    }

    const visitorGrowthData = await prisma.visitorIP.findMany({
      where: visitorGrowthWhere,
      select: {
        firstVisit: true,
      },
      orderBy: {
        firstVisit: 'asc',
      },
    });

    // Group visitors by date based on interval
    const visitorGrowthByDate: { [key: string]: number } = {};
    visitorGrowthData.forEach((visitor) => {
      let key: string;
      const date = new Date(visitor.firstVisit);
      
      if (interval === 'hour') {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        key = `${date.getFullYear()}-${month}-${day}-${hour}`;
      } else if (interval === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (interval === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (interval === 'month') {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        key = `${date.getFullYear()}-${month}`;
      } else {
        key = date.toISOString().split('T')[0];
      }
      
      visitorGrowthByDate[key] = (visitorGrowthByDate[key] || 0) + 1;
    });

    // Create array of counts and labels
    const counts: number[] = [];
    const labels: string[] = [];
    
    if (timeRange === 'all') {
      // For all time, show monthly data
      const firstVisitor = visitorGrowthData[0];
      if (firstVisitor) {
        const start = new Date(firstVisitor.firstVisit);
        const end = new Date();
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        
        while (current <= end) {
          const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          const label = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          labels.push(label);
          counts.push(visitorGrowthByDate[key] || 0);
          current.setMonth(current.getMonth() + 1);
        }
      }
    } else {
      // For specific time ranges
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date(now);
        let key: string;
        let label: string;
        
        if (interval === 'hour') {
          date.setHours(date.getHours() - i);
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hour = String(date.getHours()).padStart(2, '0');
          key = `${date.getFullYear()}-${month}-${day}-${hour}`;
          label = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        } else if (interval === 'day') {
          date.setDate(date.getDate() - i);
          key = date.toISOString().split('T')[0];
          label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (interval === 'week') {
          date.setDate(date.getDate() - (i * 7));
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          label = `Week ${Math.floor((daysBack - i) / 7) + 1}`;
        } else {
          date.setDate(date.getDate() - i);
          key = date.toISOString().split('T')[0];
          label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        labels.push(label);
        counts.push(visitorGrowthByDate[key] || 0);
      }
    }

    // Calculate cumulative counts for the graph
    let cumulative = 0;
    const cumulativeCounts = counts.map((count) => {
      cumulative += count;
      return cumulative;
    });

    // Get device type distribution
    const deviceTypeDistribution = await prisma.visitorIP.groupBy({
      by: ['deviceType'],
      _count: {
        deviceType: true,
      },
      where: {
        deviceType: {
          not: null,
        },
      },
    });

    // Format device type distribution
    const deviceStats = {
      mobile: 0,
      tablet: 0,
      desktop: 0,
      unknown: 0,
    };

    deviceTypeDistribution.forEach((item) => {
      const deviceType = item.deviceType?.toLowerCase() || 'unknown';
      if (deviceType === 'mobile') {
        deviceStats.mobile = item._count.deviceType;
      } else if (deviceType === 'tablet') {
        deviceStats.tablet = item._count.deviceType;
      } else if (deviceType === 'desktop') {
        deviceStats.desktop = item._count.deviceType;
      } else {
        deviceStats.unknown = item._count.deviceType;
      }
    });

    // Get OS distribution (top 10)
    const osDistribution = await prisma.visitorIP.groupBy({
      by: ['os'],
      _count: {
        os: true,
      },
      where: {
        os: {
          not: null,
        },
      },
      orderBy: {
        _count: {
          os: 'desc',
        },
      },
      take: 10,
    });

    // Get browser distribution (top 10)
    const browserDistribution = await prisma.visitorIP.groupBy({
      by: ['browser'],
      _count: {
        browser: true,
      },
      where: {
        browser: {
          not: null,
        },
      },
      orderBy: {
        _count: {
          browser: 'desc',
        },
      },
      take: 10,
    });

    res.json({
      totalUsers,
      registeredUsers,
      unregisteredUsers,
      totalVisitors: totalAppUsers, // Total app users = count(visitor_ips)
      totalGames,
      contestAttempted,
      timeRange,
      visitorGrowth: {
        labels,
        data: cumulativeCounts,
        dailyData: counts,
      },
      deviceDistribution: {
        mobile: deviceStats.mobile,
        tablet: deviceStats.tablet,
        desktop: deviceStats.desktop,
        unknown: deviceStats.unknown,
      },
      osDistribution: osDistribution.map(item => ({
        os: item.os || 'Unknown',
        count: item._count.os,
      })),
      browserDistribution: browserDistribution.map(item => ({
        browser: item.browser || 'Unknown',
        count: item._count.browser,
      })),
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;

