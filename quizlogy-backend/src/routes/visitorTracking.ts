import express, { Request, Response } from 'express';
import { getClientIP, updateExitPage } from '../middleware/ipTracking';
import prisma from '../config/database';

const router = express.Router();

// Track page visit
// Note: Visit count is handled by middleware based on session timeout
// This endpoint just updates the last visited page and device info
router.post('/visit', async (req: Request, res: Response) => {
  try {
    const ip = getClientIP(req);
    const { page, screenResolution } = req.body;

    if (!page || ip === 'unknown') {
      return res.json({ status: true, message: 'Visit tracked' });
    }

    // Update last visited page and screen resolution (visit count is handled by middleware)
    const visitor = await prisma.visitorIP.findUnique({
      where: { ipAddress: ip },
    });

    if (visitor) {
      const updateData: any = {
        lastVisitedPage: page,
        lastVisit: new Date(),
      };
      
      // Update screen resolution if provided
      if (screenResolution) {
        updateData.screenResolution = screenResolution;
      }
      
      await prisma.visitorIP.update({
        where: { ipAddress: ip },
        data: updateData,
      });
    }
    // If visitor doesn't exist, middleware will create it on next request

    res.json({ status: true, message: 'Visit tracked' });
  } catch (error) {
    console.error('Error tracking visit:', error);
    res.status(500).json({ error: 'Failed to track visit' });
  }
});

// Track page exit
router.post('/exit', async (req: Request, res: Response) => {
  try {
    const ip = getClientIP(req);
    const { page } = req.body;

    if (!page || ip === 'unknown') {
      return res.json({ status: true, message: 'Exit tracked' });
    }

    await updateExitPage(ip, page);

    res.json({ status: true, message: 'Exit tracked' });
  } catch (error) {
    console.error('Error tracking exit:', error);
    res.status(500).json({ error: 'Failed to track exit' });
  }
});

// Track click
router.post('/click', async (req: Request, res: Response) => {
  try {
    const ip = getClientIP(req);
    const { element, page } = req.body;

    if (ip === 'unknown') {
      return res.json({ status: true, message: 'Click tracked' });
    }

    // Get existing visitor or create new one
    const visitor = await prisma.visitorIP.findUnique({
      where: { ipAddress: ip },
    });

    if (visitor) {
      // Update click counts
      await prisma.visitorIP.update({
        where: { ipAddress: ip },
        data: {
          clickCount: visitor.clickCount + 1,
          lastSessionClicks: visitor.lastSessionClicks + 1,
          lastVisitedPage: page || visitor.lastVisitedPage,
          lastVisit: new Date(),
        },
      });
    } else {
      // Create new visitor with first click
      const now = new Date();
      await prisma.visitorIP.create({
        data: {
          ipAddress: ip,
          visitCount: 1,
          clickCount: 1,
          lastSessionClicks: 1,
          lastVisitedPage: page,
          lastSessionStart: now,
          firstVisit: now,
          lastVisit: now,
        },
      });
    }

    res.json({ status: true, message: 'Click tracked' });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// Reset session clicks (called when new session starts)
// Note: This is now handled automatically by the middleware based on session timeout
// This endpoint is kept for manual resets if needed
router.post('/reset-session', async (req: Request, res: Response) => {
  try {
    const ip = getClientIP(req);

    if (ip === 'unknown') {
      return res.json({ status: true, message: 'Session reset' });
    }

    const visitor = await prisma.visitorIP.findUnique({
      where: { ipAddress: ip },
    });

    if (visitor) {
      const now = new Date();
      await prisma.visitorIP.update({
        where: { ipAddress: ip },
        data: {
          lastSessionClicks: 0,
          lastSessionStart: now,
          // Increment visit count for new session
          visitCount: visitor.visitCount + 1,
        },
      });
    }
    // If visitor doesn't exist, that's fine - they'll be created on first click/visit

    res.json({ status: true, message: 'Session reset' });
  } catch (error) {
    console.error('Error resetting session:', error);
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

// Get visitor info (for debugging/admin)
router.get('/info', async (req: Request, res: Response) => {
  try {
    const ip = getClientIP(req);

    if (ip === 'unknown') {
      return res.json({ ip, message: 'IP not detected' });
    }

    const visitor = await prisma.visitorIP.findUnique({
      where: { ipAddress: ip },
    });

    res.json({
      status: true,
      ip,
      visitor: visitor || null,
    });
  } catch (error) {
    console.error('Error getting visitor info:', error);
    res.status(500).json({ error: 'Failed to get visitor info' });
  }
});

export default router;

