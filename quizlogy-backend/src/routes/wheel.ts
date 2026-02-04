import express, { Request, Response } from 'express';
import { isAuthenticated, AuthRequest } from '../middleware/auth';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import prisma from '../config/database';

const router = express.Router();

// Get active wheel configuration
router.get('/wheel', async (req: Request, res: Response) => {
  try {
    const wheel = await prisma.wheel.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!wheel) {
      // Return default wheel if none exists
      return res.json({
        status: true,
        data: {
          id: null,
          name: 'Spin Wheel',
          spinCost: 10,
          prizes: [
            { label: '10', value: 10, probability: 0.3, color: '#FF6B6B' },
            { label: '20', value: 20, probability: 0.25, color: '#4ECDC4' },
            { label: '50', value: 50, probability: 0.2, color: '#45B7D1' },
            { label: '100', value: 100, probability: 0.15, color: '#FFA07A' },
            { label: '200', value: 200, probability: 0.08, color: '#98D8C8' },
            { label: '500', value: 500, probability: 0.02, color: '#F7DC6F' },
          ],
        },
      });
    }

    // Parse prizes JSON
    let prizes;
    try {
      prizes = typeof wheel.prizes === 'string' ? JSON.parse(wheel.prizes) : wheel.prizes;
    } catch {
      prizes = [];
    }

    res.json({
      status: true,
      data: {
        id: wheel.id,
        name: wheel.name,
        spinCost: wheel.spinCost,
        prizes,
      },
    });
  } catch (error: any) {
    console.error('Error fetching wheel:', error);
    res.status(500).json({ error: 'Failed to fetch wheel configuration' });
  }
});

// Spin the wheel (authenticated users only)
router.post('/wheel/spin', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get active wheel
    const wheel = await prisma.wheel.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!wheel) {
      return res.status(404).json({ error: 'Wheel not found' });
    }

    // Get user's current coins
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has enough coins
    if (user.coins < wheel.spinCost) {
      return res.status(400).json({
        error: 'Insufficient coins',
        required: wheel.spinCost,
        available: user.coins,
      });
    }

    // Parse prizes
    let prizes;
    try {
      prizes = typeof wheel.prizes === 'string' ? JSON.parse(wheel.prizes) : wheel.prizes;
    } catch {
      return res.status(500).json({ error: 'Invalid wheel configuration' });
    }

    if (!Array.isArray(prizes) || prizes.length === 0) {
      return res.status(500).json({ error: 'No prizes configured' });
    }

    // Calculate cumulative probabilities
    const cumulativeProbs: number[] = [];
    let sum = 0;
    for (const prize of prizes) {
      sum += prize.probability || 0;
      cumulativeProbs.push(sum);
    }

    // Normalize probabilities if they don't sum to 1
    if (sum !== 1) {
      for (let i = 0; i < cumulativeProbs.length; i++) {
        cumulativeProbs[i] = cumulativeProbs[i] / sum;
      }
    }

    // Spin the wheel - select prize based on probability
    const random = Math.random();
    let selectedPrize = prizes[0];
    for (let i = 0; i < cumulativeProbs.length; i++) {
      if (random <= cumulativeProbs[i]) {
        selectedPrize = prizes[i];
        break;
      }
    }

    // Process spin in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct spin cost
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: {
            decrement: wheel.spinCost,
          },
        },
        select: { coins: true },
      });

      // Award prize coins
      const finalUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: {
            increment: selectedPrize.value,
          },
        },
        select: { coins: true },
      });

      // Create coin history for spin cost
      await tx.coinHistory.create({
        data: {
          userId,
          amount: -wheel.spinCost,
          type: 'SPENT',
          description: `Spun the wheel`,
        },
      });

      // Create coin history for prize
      await tx.coinHistory.create({
        data: {
          userId,
          amount: selectedPrize.value,
          type: 'EARNED',
          description: `Won ${selectedPrize.label} coins from wheel spin`,
        },
      });

      // Record spin
      const spin = await tx.wheelSpin.create({
        data: {
          userId,
          wheelId: wheel.id,
          prizeLabel: selectedPrize.label,
          prizeValue: selectedPrize.value,
          spinCost: wheel.spinCost,
        },
      });

      return { user: finalUser, spin };
    });

    res.json({
      status: true,
      message: 'Wheel spun successfully',
      data: {
        prize: {
          label: selectedPrize.label,
          value: selectedPrize.value,
        },
        coins: result.user.coins,
        spinId: result.spin.id,
      },
    });
  } catch (error: any) {
    console.error('Error spinning wheel:', error);
    res.status(500).json({ error: 'Failed to spin wheel' });
  }
});

// Get user's spin history
router.get('/wheel/history', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNumber = parseInt(page as string) || 1;
    const pageLimit = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (pageNumber - 1) * pageLimit;

    const spins = await prisma.wheelSpin.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageLimit,
      include: {
        wheel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const totalCount = await prisma.wheelSpin.count({
      where: { userId },
    });

    res.json({
      status: true,
      data: spins,
      pagination: {
        page: pageNumber,
        limit: pageLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching spin history:', error);
    res.status(500).json({ error: 'Failed to fetch spin history' });
  }
});

// Admin: Get all wheels
router.get('/admin/wheels', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const wheels = await prisma.wheel.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const wheelsWithParsedPrizes = wheels.map((wheel) => {
      let prizes;
      try {
        prizes = typeof wheel.prizes === 'string' ? JSON.parse(wheel.prizes) : wheel.prizes;
      } catch {
        prizes = [];
      }
      return {
        ...wheel,
        prizes,
      };
    });

    res.json({
      status: true,
      data: wheelsWithParsedPrizes,
    });
  } catch (error: any) {
    console.error('Error fetching wheels:', error);
    res.status(500).json({ error: 'Failed to fetch wheels' });
  }
});

// Admin: Create or update wheel
router.post('/admin/wheels', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { name, isActive, spinCost, prizes } = req.body;

    if (!prizes || !Array.isArray(prizes) || prizes.length === 0) {
      return res.status(400).json({ error: 'Prizes array is required' });
    }

    // Validate prizes
    for (const prize of prizes) {
      if (!prize.label || prize.value === undefined || prize.probability === undefined) {
        return res.status(400).json({ error: 'Each prize must have label, value, and probability' });
      }
      if (prize.value < 0) {
        return res.status(400).json({ error: 'Prize value must be non-negative' });
      }
      if (prize.probability < 0 || prize.probability > 1) {
        return res.status(400).json({ error: 'Probability must be between 0 and 1' });
      }
    }

    // If setting this wheel as active, deactivate others
    if (isActive) {
      await prisma.wheel.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const wheel = await prisma.wheel.create({
      data: {
        name: name || 'Spin Wheel',
        isActive: isActive !== undefined ? isActive : true,
        spinCost: spinCost || 10,
        prizes: JSON.stringify(prizes),
      },
    });

    res.json({
      status: true,
      message: 'Wheel created successfully',
      data: {
        ...wheel,
        prizes: JSON.parse(wheel.prizes),
      },
    });
  } catch (error: any) {
    console.error('Error creating wheel:', error);
    res.status(500).json({ error: 'Failed to create wheel' });
  }
});

// Admin: Update wheel
router.put('/admin/wheels/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const wheelId = req.params.id;
    const { name, isActive, spinCost, prizes } = req.body;

    const existingWheel = await prisma.wheel.findUnique({
      where: { id: wheelId },
    });

    if (!existingWheel) {
      return res.status(404).json({ error: 'Wheel not found' });
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (spinCost !== undefined) updateData.spinCost = Math.max(0, parseInt(spinCost.toString()));
    
    if (prizes !== undefined) {
      if (!Array.isArray(prizes) || prizes.length === 0) {
        return res.status(400).json({ error: 'Prizes must be a non-empty array' });
      }
      // Validate prizes
      for (const prize of prizes) {
        if (!prize.label || prize.value === undefined || prize.probability === undefined) {
          return res.status(400).json({ error: 'Each prize must have label, value, and probability' });
        }
      }
      updateData.prizes = JSON.stringify(prizes);
    }

    // If setting this wheel as active, deactivate others
    if (isActive && !existingWheel.isActive) {
      await prisma.wheel.updateMany({
        where: { isActive: true, id: { not: wheelId } },
        data: { isActive: false },
      });
      updateData.isActive = true;
    } else if (isActive === false) {
      updateData.isActive = false;
    }

    const updatedWheel = await prisma.wheel.update({
      where: { id: wheelId },
      data: updateData,
    });

    res.json({
      status: true,
      message: 'Wheel updated successfully',
      data: {
        ...updatedWheel,
        prizes: JSON.parse(updatedWheel.prizes),
      },
    });
  } catch (error: any) {
    console.error('Error updating wheel:', error);
    res.status(500).json({ error: 'Failed to update wheel' });
  }
});

// Admin: Delete wheel
router.delete('/admin/wheels/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const wheelId = req.params.id;

    const wheel = await prisma.wheel.findUnique({
      where: { id: wheelId },
    });

    if (!wheel) {
      return res.status(404).json({ error: 'Wheel not found' });
    }

    await prisma.wheel.delete({
      where: { id: wheelId },
    });

    res.json({
      status: true,
      message: 'Wheel deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting wheel:', error);
    res.status(500).json({ error: 'Failed to delete wheel' });
  }
});

export default router;

