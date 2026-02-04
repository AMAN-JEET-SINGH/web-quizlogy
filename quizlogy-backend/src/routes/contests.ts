import express, { Request, Response } from 'express';
import { isAuthenticated, AuthRequest } from '../middleware/auth';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import prisma from '../config/database';

const router = express.Router();

// Helper function to get image URL
function getImageUrl(imagePath: string): string | null {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.IMAGE_BASE_URL || 'http://localhost:5001';
  const digitalOceanUrl = process.env.DIGITAL_OCEAN_IMAGE_URL;

  if (!imagePath || imagePath === 'default' || imagePath === 'placeholder' || imagePath.trim() === '' || imagePath.includes('default.jpg') || imagePath.includes('placeholder.jpg')) {
    return null;
  }

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  if (imagePath.startsWith('uploads/')) {
    if (isProduction && digitalOceanUrl) {
      return `${digitalOceanUrl}/${imagePath}`;
    } else {
      return `${baseUrl}/${imagePath}`;
    }
  }

  if (isProduction && digitalOceanUrl) {
    return `${digitalOceanUrl}/${imagePath}`;
  } else {
    return `${baseUrl}/${imagePath}`;
  }
}

// Helper function to calculate contest status based on dates
function calculateStatus(startDate: Date, endDate: Date, resultDate: Date): string {
  const now = new Date();
  
  if (now < startDate) {
    return 'UPCOMING';
  } else if (now >= startDate && now <= endDate) {
    return 'ACTIVE';
  } else if (now > endDate && now <= resultDate) {
    return 'RESULT_PENDING';
  } else {
    return 'PREVIOUS';
  }
}

// Helper function to parse prize pool
function parsePrizePool(prizePoolJson: string): string[] {
  try {
    return JSON.parse(prizePoolJson);
  } catch {
    return ["50000", "40000", "30000", "20000", "10000", "5000", "4000", "3000", "2000", "1000"];
  }
}

// IMPORTANT: Specific routes must come before generic routes (/:id)
// Get contest list - matches /api/contestList
router.get('/contestList', async (req: Request, res: Response) => {
  console.log('📥 GET /api/contestList - Request received');
  try {
    const { category, status, region } = req.query;
    console.log('Query params:', { category, status, region });
    
    // Get client region from IP tracking middleware
    const clientRegion = (req as any).clientRegion || 'ALL';
    console.log('Client region from IP:', clientRegion);
    
    const where: any = {};
    
    if (category) {
      where.categoryId = category as string;
    }
    
    // Filter contests based on IP location
    // If user is from India (IND), show IND and ALL contests
    // If user is from other countries (ALL), only show ALL contests
    if (clientRegion === 'IND') {
      // Indian users can see both IND and ALL contests
      where.region = { in: ['IND', 'ALL'] };
    } else {
      // Non-Indian users can only see ALL contests
      where.region = 'ALL';
    }
    
    // Override with explicit region filter if provided in query
    if (region && region !== 'ALL') {
      // Only allow filtering if user is from India
      if (clientRegion === 'IND') {
        where.region = region as string;
      } else {
        // Non-Indian users can't filter by IND region
        where.region = 'ALL';
      }
    }

    const contests = await prisma.contest.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            backgroundColor: true,
            imagePath: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform contests to match expected format
    const now = new Date();
    const transformedContests = contests.map((contest) => {
      const contestStatus = contest.isDaily 
        ? 'DAILY' 
        : calculateStatus(
            contest.startDate || new Date(), 
            contest.endDate || new Date(), 
            contest.resultDate || new Date()
          );
      
      // Filter by status if provided
      if (status && contestStatus !== status) {
        return null;
      }
      
      return {
        id: contest.id,
        name: contest.name,
        contestImage: contest.imagePath || '', // Send full path to preserve category/contest directory
        category: contest.categoryId,
        categoryName: contest.category?.name || '',
        categoryBackgroundColor: contest.category?.backgroundColor || null,
        categoryImagePath: contest.category?.imagePath || null,
        joining_fee: contest.joiningFee,
        startDate: contest.startDate,
        endDate: contest.endDate,
        resultDate: contest.resultDate,
        status: contest.isDaily ? 'DAILY' : contestStatus,
        winCoins: parseInt(parsePrizePool(contest.prizePool)[0] || '50000'),
        isDaily: contest.isDaily || false,
        dailyStartTime: contest.dailyStartTime,
        dailyEndTime: contest.dailyEndTime,
      };
    }).filter(Boolean);

    // Get unique category IDs
    const categories = [...new Set(contests.map(c => c.categoryId))];

    console.log(` Returning ${transformedContests.length} contests`);
    res.json({
      status: true,
      data: transformedContests,
      totalResults: transformedContests.length,
      categories,
    });
  } catch (error: any) {
    console.error(' Error fetching contests:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch contests',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Join a contest (deduct coins and create participation)
// This route must come BEFORE /contest/:id to avoid route conflicts
router.post('/contest/:id/join', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const contestId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get contest details
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Check if daily contest is currently live
    if (contest.isDaily) {
      if (!contest.dailyStartTime || !contest.dailyEndTime) {
        return res.status(400).json({ error: 'Daily contest times are not configured' });
      }

      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTotalMinutes = currentHours * 60 + currentMinutes;

      const [startHours, startMinutes] = contest.dailyStartTime.split(':').map(Number);
      const [endHours, endMinutes] = contest.dailyEndTime.split(':').map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      const isLive = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;

      if (!isLive) {
        const nextStart = new Date(now);
        nextStart.setHours(startHours, startMinutes, 0, 0);
        if (nextStart <= now) {
          nextStart.setDate(nextStart.getDate() + 1);
        }
        const timeStr = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
        return res.status(400).json({ 
          error: `Daily contest is not currently live. Come back tomorrow to play daily quiz at ${timeStr}` 
        });
      }
    } else {
      // For regular contests, check if contest is active
      const now = new Date();
      if (contest.startDate && now < contest.startDate) {
        return res.status(400).json({ error: 'Contest has not started yet' });
      }
      if (contest.endDate && now > contest.endDate) {
        return res.status(400).json({ error: 'Contest has ended' });
      }
    }

    // Check if user already participated
    const existingParticipation = await prisma.contestParticipation.findUnique({
      where: {
        userId_contestId: {
          userId,
          contestId,
        },
      },
    });

    if (existingParticipation) {
      return res.status(400).json({ error: 'You have already joined this contest' });
    }

    // Get user's current coin balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has enough coins
    if (user.coins < contest.joiningFee) {
      return res.status(400).json({ 
        error: 'Insufficient coins',
        required: contest.joiningFee,
        available: user.coins,
      });
    }

    // Deduct coins and create participation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct coins from user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: {
            decrement: contest.joiningFee,
          },
        },
        select: {
          coins: true,
        },
      });

      // Create coin history entry
      await tx.coinHistory.create({
        data: {
          userId,
          amount: -contest.joiningFee,
          type: 'SPENT',
          description: `Joined contest: ${contest.name}`,
          contestId,
        },
      });

      // Create contest participation
      const participation = await tx.contestParticipation.create({
        data: {
          userId,
          contestId,
        },
      });

      return { updatedUser, participation };
    });

    res.json({
      status: true,
      message: 'Successfully joined contest',
      coins: result.updatedUser.coins,
    });
  } catch (error: any) {
    console.error('Error joining contest:', error);
    res.status(500).json({ error: 'Failed to join contest' });
  }
});

// Use lifeline in contest (deduct coins)
router.post('/contest/:id/use-lifeline', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const contestId = req.params.id;
    const { lifelineType } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get contest details
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    const lifelineCost = contest.lifeLineCharge || 0;

    // Get user's current coin balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has enough coins
    if (user.coins < lifelineCost) {
      return res.status(400).json({ 
        error: 'Insufficient coins',
        required: lifelineCost,
        available: user.coins,
      });
    }

    // Deduct coins and create coin history in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct coins from user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: {
            decrement: lifelineCost,
          },
        },
        select: {
          coins: true,
        },
      });

      // Create coin history entry
      await tx.coinHistory.create({
        data: {
          userId,
          amount: -lifelineCost,
          type: 'SPENT',
          description: `Used ${lifelineType} lifeline in contest: ${contest.name}`,
          contestId,
        },
      });

      return updatedUser;
    });

    res.json({
      status: true,
      message: 'Lifeline activated successfully',
      coins: result.coins,
    });
  } catch (error: any) {
    console.error('Error using lifeline:', error);
    res.status(500).json({ error: 'Failed to use lifeline' });
  }
});

// Submit contest results
router.post('/contest/:id/submit', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const contestId = req.params.id;
    const { score, answers } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get contest details
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Find or create participation
    let participation = await prisma.contestParticipation.findUnique({
      where: {
        userId_contestId: {
          userId,
          contestId,
        },
      },
    });

    if (!participation) {
      return res.status(404).json({ error: 'Participation not found. Please join the contest first.' });
    }

    // Update participation with results
    participation = await prisma.contestParticipation.update({
      where: { id: participation.id },
      data: {
        score: score || 0,
        answers: JSON.stringify(answers || []),
        completedAt: new Date(),
      },
    });

    // Calculate and update rank
    await updateContestRanks(contestId);

    // Get updated participation with rank
    const updatedParticipation = await prisma.contestParticipation.findUnique({
      where: { id: participation.id },
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
      message: 'Contest results submitted successfully',
      data: updatedParticipation,
    });
  } catch (error: any) {
    console.error('Error submitting contest results:', error);
    res.status(500).json({ error: 'Failed to submit contest results' });
  }
});

// Get user's rank in a contest
router.get('/contest/:id/rank', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const contestId = req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const participation = await prisma.contestParticipation.findUnique({
      where: {
        userId_contestId: {
          userId,
          contestId,
        },
      },
      select: {
        score: true,
        rank: true,
        completedAt: true,
      },
    });

    if (!participation) {
      return res.status(404).json({ error: 'Participation not found' });
    }

    // Get total participants
    const totalParticipants = await prisma.contestParticipation.count({
      where: {
        contestId,
        completedAt: { not: null },
      },
    });

    res.json({
      status: true,
      rank: participation.rank,
      score: participation.score,
      totalParticipants,
    });
  } catch (error: any) {
    console.error('Error fetching rank:', error);
    res.status(500).json({ error: 'Failed to fetch rank' });
  }
});

// Get contest leaderboard
router.get('/contest/:id/leaderboard', async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id;
    const { limit = 10 } = req.query;

    const leaderboard = await prisma.contestParticipation.findMany({
      where: {
        contestId,
        completedAt: { not: null },
      },
      orderBy: [
        { score: 'desc' },
        { completedAt: 'asc' }, // Earlier completion ranks higher if same score
      ],
      take: parseInt(limit as string),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            picture: true,
          },
        },
      },
    });

    res.json({
      status: true,
      data: leaderboard,
    });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Helper function to update ranks for a contest
async function updateContestRanks(contestId: string) {
  const participations = await prisma.contestParticipation.findMany({
    where: {
      contestId,
      completedAt: { not: null },
    },
    orderBy: [
      { score: 'desc' },
      { completedAt: 'asc' },
    ],
  });

  // Update ranks
  for (let i = 0; i < participations.length; i++) {
    await prisma.contestParticipation.update({
      where: { id: participations[i].id },
      data: { rank: i + 1 },
    });
  }
}

// Get contest by ID - matches /api/contest/:id (specific route)
router.get('/contest/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.id;

    const contest = await prisma.contest.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        questions: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Check if user has already played
    let alreadyPlayed = false;
    if (userId) {
      const participation = await prisma.contestParticipation.findUnique({
        where: {
          userId_contestId: {
            userId,
            contestId: id,
          },
        },
      });
      alreadyPlayed = !!participation?.completedAt;
    }

    // Transform questions and randomize them
    let questions = contest.questions.map((q) => {
      let options: string[] = [];
      try {
        options = JSON.parse(q.options);
      } catch {
        options = [];
      }

      return {
        id: q.id,
        question: q.question,
        type: q.type,
        media: q.media ? getImageUrl(q.media) : null,
        options,
        correctOption: q.correctOption,
      };
    });

    // Shuffle questions array to randomize order (Fisher-Yates shuffle)
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    // Randomize options order for each question (but track correct option)
    questions = questions.map((q) => {
      const options = [...q.options];
      const correctOption = q.correctOption;
      
      // Shuffle options array
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      
      // Return with shuffled options and updated correctOption (which stays the same value, just the order changed)
      return {
        ...q,
        options,
        correctOption, // The correct option value remains the same, just its position in options array changes
      };
    });

    // Parse prize pool
    const winnerAmount = parsePrizePool(contest.prizePool);

    // Check if daily contest is currently live
    let isDailyLive = false;
    if (contest.isDaily && contest.dailyStartTime && contest.dailyEndTime) {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTotalMinutes = currentHours * 60 + currentMinutes;

      const [startHours, startMinutes] = contest.dailyStartTime.split(':').map(Number);
      const [endHours, endMinutes] = contest.dailyEndTime.split(':').map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      isDailyLive = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
    }

    const contestStatus = contest.isDaily 
      ? (isDailyLive ? 'DAILY_LIVE' : 'DAILY_UPCOMING')
      : calculateStatus(contest.startDate || new Date(), contest.endDate || new Date(), contest.resultDate || new Date());

    res.json({
      status: true,
      data: {
        id: contest.id,
        name: contest.name,
        description: contest.description,
        contestImage: contest.imagePath || '', // Send full path to preserve category/contest directory
        category: {
          id: contest.category.id,
          name: contest.category.name,
        },
        joining_fee: contest.joiningFee,
        duration: contest.duration,
        marking: contest.marking,
        negative_marking: contest.negativeMarking,
        contest_question_count: contest.questionCount,
        lifeLineCharge: contest.lifeLineCharge,
        startDate: contest.startDate,
        endDate: contest.endDate,
        resultDate: contest.resultDate,
        isDaily: contest.isDaily || false,
        dailyStartTime: contest.dailyStartTime,
        dailyEndTime: contest.dailyEndTime,
        isDailyLive: isDailyLive,
        status: contestStatus,
        winCoins: parseInt(winnerAmount[0] || '50000'),
        winnerAmount,
        questions,
      },
      alreadyPlayed,
    });
  } catch (error) {
    console.error('Error fetching contest:', error);
    res.status(500).json({ error: 'Failed to fetch contest' });
  }
});

// Get all contests (admin/alternative endpoint)
// Note: This route is at /api/contests (when mounted) to avoid conflicts
// For karekasie-client compatibility, use /api/contestList instead
// This endpoint is kept for admin panel
router.get('/contests', async (req: Request, res: Response) => {
  console.log('📥 GET /api/contests - Request received');
  try {
    const contests = await prisma.contest.findMany({
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const transformedContests = contests.map((contest) => ({
      ...contest,
      imageUrl: getImageUrl(contest.imagePath),
      status: contest.isDaily 
        ? 'DAILY' 
        : calculateStatus(contest.startDate || new Date(), contest.endDate || new Date(), contest.resultDate || new Date()),
    }));

    res.json(transformedContests);
  } catch (error) {
    console.error('Error fetching contests:', error);
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

// Get contest by ID (admin/alternative endpoint)
// Note: Use /api/contest/:id for karekasie-client compatibility
// This endpoint is for admin panel at /api/contests/:id
router.get('/contests/:id', async (req: Request, res: Response) => {
  try {
    const contest = await prisma.contest.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        questions: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    res.json({
      ...contest,
      imageUrl: getImageUrl(contest.imagePath),
      status: contest.isDaily 
        ? 'DAILY' 
        : calculateStatus(contest.startDate || new Date(), contest.endDate || new Date(), contest.resultDate || new Date()),
    });
  } catch (error) {
    console.error('Error fetching contest:', error);
    res.status(500).json({ error: 'Failed to fetch contest' });
  }
});

// Create contest (admin only)
router.post('/contests', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const {
      name,
      description,
      categoryId,
      imagePath,
      startDate,
      endDate,
      resultDate,
      isDaily,
      dailyStartTime,
      dailyEndTime,
      joiningFee,
      questionCount,
      duration,
      region,
      prizePool,
      marking,
      negativeMarking,
      lifeLineCharge,
    } = req.body;

    // Validation
    if (!name || !categoryId) {
      return res.status(400).json({
        error: 'Missing required fields: name and categoryId are required',
      });
    }

    // Validate daily contest
    if (isDaily) {
      if (!dailyStartTime || !dailyEndTime) {
        return res.status(400).json({
          error: 'For daily contests, dailyStartTime and dailyEndTime are required',
        });
      }
      
      // Validate time format (HH:mm)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(dailyStartTime) || !timeRegex.test(dailyEndTime)) {
        return res.status(400).json({
          error: 'Invalid time format. Use HH:mm format (e.g., 15:00)',
        });
      }
      
      // Validate end time is after start time
      const [startHours, startMinutes] = dailyStartTime.split(':').map(Number);
      const [endHours, endMinutes] = dailyEndTime.split(':').map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      
      if (endTotalMinutes <= startTotalMinutes) {
        return res.status(400).json({
          error: 'End time must be after start time',
        });
      }
    } else {
      // Validate regular contest
      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'For regular contests, startDate and endDate are required',
        });
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end <= start) {
        return res.status(400).json({
          error: 'End date must be after start date',
        });
      }
    }

    // Validate category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Default prize pool if not provided
    const finalPrizePool = prizePool 
      ? (typeof prizePool === 'string' ? prizePool : JSON.stringify(prizePool))
      : JSON.stringify(["50000", "40000", "30000", "20000", "10000", "5000", "4000", "3000", "2000", "1000"]);

    const contestData: any = {
      name,
      description: description || null,
      categoryId,
      imagePath: imagePath || 'uploads/contests/default.jpg',
      isDaily: isDaily || false,
      joiningFee: joiningFee !== undefined ? Math.max(0, parseInt(joiningFee.toString()) || 0) : 0,
      questionCount: questionCount || 10,
      duration: duration || 90,
      region: region || 'ALL',
      prizePool: finalPrizePool,
      marking: marking || 20,
      negativeMarking: negativeMarking || 5,
      lifeLineCharge: lifeLineCharge || 1,
    };

    // Set dates or daily times based on contest type
    if (isDaily) {
      contestData.startDate = null;
      contestData.endDate = null;
      contestData.resultDate = null;
      contestData.dailyStartTime = dailyStartTime;
      contestData.dailyEndTime = dailyEndTime;
    } else {
      contestData.startDate = new Date(startDate);
      contestData.endDate = new Date(endDate);
      contestData.resultDate = resultDate ? new Date(resultDate) : new Date(endDate);
      contestData.dailyStartTime = null;
      contestData.dailyEndTime = null;
    }

    const contest = await prisma.contest.create({
      data: contestData,
      include: {
        category: true,
      },
    });

    res.status(201).json({
      ...contest,
      imageUrl: getImageUrl(contest.imagePath),
      status: contest.isDaily 
        ? 'DAILY' 
        : calculateStatus(contest.startDate || new Date(), contest.endDate || new Date(), contest.resultDate || new Date()),
    });
  } catch (error) {
    console.error('Error creating contest:', error);
    res.status(500).json({ error: 'Failed to create contest' });
  }
});

// Update contest (admin only)
router.put('/contests/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: any = {};

    const contest = await prisma.contest.findUnique({
      where: { id },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Build update data object
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.categoryId) updateData.categoryId = req.body.categoryId;
    if (req.body.imagePath) updateData.imagePath = req.body.imagePath;
    if (req.body.isDaily !== undefined) updateData.isDaily = req.body.isDaily;
    
    // Handle daily vs regular contest fields
    if (req.body.isDaily) {
      // For daily contests, validate and set times
      if (req.body.dailyStartTime && req.body.dailyEndTime) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(req.body.dailyStartTime) || !timeRegex.test(req.body.dailyEndTime)) {
          return res.status(400).json({
            error: 'Invalid time format. Use HH:mm format (e.g., 15:00)',
          });
        }
        
        const [startHours, startMinutes] = req.body.dailyStartTime.split(':').map(Number);
        const [endHours, endMinutes] = req.body.dailyEndTime.split(':').map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        if (endTotalMinutes <= startTotalMinutes) {
          return res.status(400).json({
            error: 'End time must be after start time',
          });
        }
        
        updateData.dailyStartTime = req.body.dailyStartTime;
        updateData.dailyEndTime = req.body.dailyEndTime;
        updateData.startDate = null;
        updateData.endDate = null;
        updateData.resultDate = null;
      }
    } else {
      // For regular contests, set dates
      if (req.body.startDate) updateData.startDate = new Date(req.body.startDate);
      if (req.body.endDate) updateData.endDate = new Date(req.body.endDate);
      if (req.body.resultDate) updateData.resultDate = new Date(req.body.resultDate);
      updateData.dailyStartTime = null;
      updateData.dailyEndTime = null;
    }
    
    if (req.body.joiningFee !== undefined) {
      updateData.joiningFee = Math.max(0, parseInt(req.body.joiningFee.toString()) || 0);
    }
    if (req.body.questionCount !== undefined) updateData.questionCount = req.body.questionCount;
    if (req.body.duration !== undefined) updateData.duration = req.body.duration;
    if (req.body.region) updateData.region = req.body.region;
    if (req.body.prizePool) {
      updateData.prizePool = typeof req.body.prizePool === 'string' 
        ? req.body.prizePool 
        : JSON.stringify(req.body.prizePool);
    }
    if (req.body.marking !== undefined) updateData.marking = req.body.marking;
    if (req.body.negativeMarking !== undefined) updateData.negativeMarking = req.body.negativeMarking;
    if (req.body.lifeLineCharge !== undefined) updateData.lifeLineCharge = req.body.lifeLineCharge;

    const updatedContest = await prisma.contest.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });

    res.json({
      ...updatedContest,
      imageUrl: getImageUrl(updatedContest.imagePath),
      status: updatedContest.isDaily 
        ? 'DAILY' 
        : calculateStatus(updatedContest.startDate || new Date(), updatedContest.endDate || new Date(), updatedContest.resultDate || new Date()),
    });
  } catch (error) {
    console.error('Error updating contest:', error);
    res.status(500).json({ error: 'Failed to update contest' });
  }
});

// Delete contest (admin only)
router.delete('/contests/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const contest = await prisma.contest.findUnique({
      where: { id },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    await prisma.contest.delete({
      where: { id },
    });

    res.json({ message: 'Contest deleted successfully' });
  } catch (error) {
    console.error('Error deleting contest:', error);
    res.status(500).json({ error: 'Failed to delete contest' });
  }
});

export default router;

