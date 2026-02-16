import express, { Request, Response } from 'express';
import { isAuthenticated, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

const router = express.Router();

// Get current user's coin balance
router.get('/balance', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        coins: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      status: true,
      coins: user.coins || 0,
    });
  } catch (error: any) {
    console.error('Error fetching coin balance:', error);
    res.status(500).json({ error: 'Failed to fetch coin balance' });
  }
});

// Get current user's coin history
router.get('/history', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { page = 1, limit = 50, type } = req.query;
    const pageNumber = parseInt(page as string) || 1;
    const pageLimit = Math.min(parseInt(limit as string) || 50, 100); // Max 100 per page
    const skip = (pageNumber - 1) * pageLimit;

    const where: any = { userId };
    
    // Filter by type if provided
    if (type && (type === 'EARNED' || type === 'SPENT' || type === 'REFUND' || type === 'LOGIN')) {
      where.type = type;
    }

    // Get total count for pagination
    const totalCount = await prisma.coinHistory.count({ where });

    // Get coin history with pagination
    const coinHistory = await prisma.coinHistory.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageLimit,
      select: {
        id: true,
        userId: true,
        amount: true,
        type: true,
        description: true,
        contestId: true,
        status: true,
        contestName: true,
        correctAnswers: true,
        wrongAnswers: true,
        totalQuestions: true,
        winningAmount: true,
        timeTaken: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      status: true,
      data: coinHistory,
      pagination: {
        page: pageNumber,
        limit: pageLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching coin history:', error);
    res.status(500).json({ error: 'Failed to fetch coin history' });
  }
});

// Create coin history entry
router.post('/history', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, type, description, contestId } = req.body;

    // Validate required fields
    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    if (!type || !['EARNED', 'SPENT', 'REFUND', 'LOGIN'].includes(type)) {
      return res.status(400).json({ error: 'Valid type is required (EARNED, SPENT, REFUND, or LOGIN)' });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Validate amount based on type
    if (type === 'EARNED' && amount < 0) {
      return res.status(400).json({ error: 'EARNED type requires positive amount' });
    }
    if (type === 'SPENT' && amount > 0) {
      return res.status(400).json({ error: 'SPENT type requires negative amount' });
    }

    // Create coin history entry
    const coinHistory = await prisma.coinHistory.create({
      data: {
        userId,
        amount: parseInt(amount),
        type,
        description: description.trim(),
        contestId: contestId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      status: true,
      message: 'Coin history entry created successfully',
      data: coinHistory,
    });
  } catch (error: any) {
    console.error('Error creating coin history:', error);
    res.status(500).json({ error: 'Failed to create coin history entry' });
  }
});

// Update coin history entry (by ID)
router.put('/history/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const historyId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if history entry exists and belongs to user
    const existingHistory = await prisma.coinHistory.findUnique({
      where: { id: historyId },
    });

    if (!existingHistory) {
      return res.status(404).json({ error: 'Coin history entry not found' });
    }

    if (existingHistory.userId !== userId) {
      return res.status(403).json({ error: 'You can only update your own coin history entries' });
    }

    const { amount, type, description, contestId } = req.body;
    const updateData: any = {};

    if (amount !== undefined) {
      updateData.amount = parseInt(amount);
    }

    if (type && ['EARNED', 'SPENT', 'REFUND', 'LOGIN'].includes(type)) {
      updateData.type = type;
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ error: 'Description must be a non-empty string' });
      }
      updateData.description = description.trim();
    }

    if (contestId !== undefined) {
      updateData.contestId = contestId || null;
    }

    // Update coin history entry
    const updatedHistory = await prisma.coinHistory.update({
      where: { id: historyId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      status: true,
      message: 'Coin history entry updated successfully',
      data: updatedHistory,
    });
  } catch (error: any) {
    console.error('Error updating coin history:', error);
    res.status(500).json({ error: 'Failed to update coin history entry' });
  }
});

// Delete coin history entry (by ID)
router.delete('/history/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const historyId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if history entry exists and belongs to user
    const existingHistory = await prisma.coinHistory.findUnique({
      where: { id: historyId },
    });

    if (!existingHistory) {
      return res.status(404).json({ error: 'Coin history entry not found' });
    }

    if (existingHistory.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own coin history entries' });
    }

    // Delete coin history entry
    await prisma.coinHistory.delete({
      where: { id: historyId },
    });

    res.json({
      status: true,
      message: 'Coin history entry deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting coin history:', error);
    res.status(500).json({ error: 'Failed to delete coin history entry' });
  }
});

// Get specific coin history entry by ID
router.get('/history/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const historyId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get coin history entry
    const coinHistory = await prisma.coinHistory.findUnique({
      where: { id: historyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!coinHistory) {
      return res.status(404).json({ error: 'Coin history entry not found' });
    }

    // Check if entry belongs to user
    if (coinHistory.userId !== userId) {
      return res.status(403).json({ error: 'You can only view your own coin history entries' });
    }

    res.json({
      status: true,
      data: coinHistory,
    });
  } catch (error: any) {
    console.error('Error fetching coin history entry:', error);
    res.status(500).json({ error: 'Failed to fetch coin history entry' });
  }
});

export default router;

