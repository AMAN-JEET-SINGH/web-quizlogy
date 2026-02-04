import express, { Response, Request } from 'express';
import { isAuthenticated, AuthRequest } from '../middleware/auth';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import prisma from '../config/database';

const router = express.Router();

// Get all users (protected route)
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user by ID
router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        givenName: true,
        familyName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin: Get all users with profiles
router.get('/admin/all', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { page = '1', limit = '50', search = '' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause for search
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        {
          profile: {
            OR: [
              { mobileNo: { contains: search as string, mode: 'insensitive' } },
              { whatsappNo: { contains: search as string, mode: 'insensitive' } },
              { city: { contains: search as string, mode: 'insensitive' } },
              { country: { contains: search as string, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users with profiles
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        googleId: true,
        coins: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            mobileNo: true,
            whatsappNo: true,
            address: true,
            city: true,
            country: true,
            postalCode: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limitNum,
    });

    res.json({
      status: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching users for admin:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;


