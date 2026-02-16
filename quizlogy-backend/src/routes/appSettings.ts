import { Router, Response } from 'express';
import { AdminRequest, isSuperAdmin } from '../middleware/adminAuth';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET / - Get current app settings (super admin only)
router.get('/', isSuperAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    let settings = await prisma.appSettings.findUnique({
      where: { id: 'global' },
    });

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: { id: 'global', revenueDeductPercent: 0 },
      });
    }

    res.json({ status: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch app settings', details: error.message });
  }
});

// PUT / - Update app settings (super admin only)
router.put('/', isSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { revenueDeductPercent } = req.body;

    if (revenueDeductPercent === undefined || revenueDeductPercent === null) {
      return res.status(400).json({ error: 'revenueDeductPercent is required' });
    }

    const percent = Number(revenueDeductPercent);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      return res.status(400).json({ error: 'revenueDeductPercent must be a number between 0 and 100' });
    }

    const settings = await prisma.appSettings.upsert({
      where: { id: 'global' },
      update: { revenueDeductPercent: percent },
      create: { id: 'global', revenueDeductPercent: percent },
    });

    res.json({ status: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update app settings', details: error.message });
  }
});

export default router;
