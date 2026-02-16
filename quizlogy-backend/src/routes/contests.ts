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

// Helper: strict priority question selection
// Country-specific questions take priority over ALL questions.
export function getApplicableQuestions(
  questions: Array<{ _countries: string[]; [key: string]: any }>,
  userCountry: string
): typeof questions {
  if (userCountry === 'ALL' || questions.length === 0) return questions;

  // Priority 1: User-country questions exist → use ONLY those
  const userSpecific = questions.filter(q => q._countries.includes(userCountry));
  if (userSpecific.length > 0) return userSpecific;

  // Priority 2: Fallback to ALL questions
  const allGlobal = questions.filter(q => q._countries.includes('ALL'));
  if (allGlobal.length > 0) return allGlobal;

  // Priority 3: No applicable questions
  return [];
}

// IMPORTANT: Specific routes must come before generic routes (/:id)
// Get contest list - matches /api/contestList
router.get('/contestList', async (req: Request, res: Response) => {
  console.log('📥 GET /api/contestList - Request received');
  try {
    const { category, status } = req.query;
    console.log('Query params:', { category, status });

    // Determine user's country code
    // Priority: query param > cf-ipcountry header > IP geo lookup
    const queryCountry = req.query.country as string;
    const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
    const ipCountry = (req as any).clientCountryCode as string | undefined;
    const isAdminSession = !!(req.session as any)?.admin;
    let userCountry = 'ALL';
    if (queryCountry && queryCountry !== 'ALL') {
      userCountry = queryCountry.toUpperCase();
    } else if (cfCountry) {
      userCountry = cfCountry.toUpperCase();
    } else if (ipCountry && ipCountry !== 'ALL' && ipCountry !== 'UN') {
      userCountry = ipCountry;
    }
    console.log('User country:', userCountry, 'isAdmin:', isAdminSession);

    const where: any = {};

    if (category) {
      where.categoryId = category as string;
    }

    // Filter contests by user's country — skip for admin sessions
    if (!isAdminSession && userCountry !== 'ALL') {
      where.OR = [
        { countries: { contains: '"ALL"' } },
        { countries: { contains: `"${userCountry}"` } },
      ];
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
        questions: { select: { countries: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform contests to match expected format
    const now = new Date();
    let transformedContests = contests.map((contest) => {
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

      // Parse countries for deduplication
      let parsedCountries: string[] = ['ALL'];
      try { parsedCountries = JSON.parse(contest.countries); } catch {}

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
        _countries: parsedCountries, // internal field for deduplication
        _questions: contest.questions.map((q: any) => {
          let qc: string[] = ['ALL'];
          try { qc = JSON.parse(q.countries); } catch {}
          return { _countries: qc };
        }),
      };
    }).filter(Boolean) as any[];

    // Filter out contests with no applicable questions for this user
    if (!isAdminSession && userCountry !== 'ALL') {
      transformedContests = transformedContests.filter((c: any) =>
        getApplicableQuestions(c._questions, userCountry).length > 0
      );
    }

    // Deduplicate by contest name: if a country-specific contest exists
    // with the same name as an ALL contest, the user sees only the
    // country-specific one. Users from other countries see the ALL version.
    let dedupedContests = transformedContests;
    if (!isAdminSession && userCountry !== 'ALL') {
      const byName = new Map<string, any[]>();
      for (const c of transformedContests) {
        const arr = byName.get(c.name) || [];
        arr.push(c);
        byName.set(c.name, arr);
      }

      dedupedContests = [];
      for (const [, group] of byName) {
        // Find contests that specifically target the user's country
        const countrySpecific = group.filter((c: any) =>
          c._countries.includes(userCountry) && !c._countries.includes('ALL')
        );
        if (countrySpecific.length > 0) {
          // User's country has a dedicated version — show only that
          dedupedContests.push(...countrySpecific);
        } else {
          // No country-specific version — show the ALL version(s)
          dedupedContests.push(...group);
        }
      }
    }

    // Strip internal _countries and _questions fields before sending response
    const finalContests = dedupedContests.map(({ _countries, _questions, ...rest }: any) => rest);

    // Get unique category IDs
    const categories = [...new Set(contests.map(c => c.categoryId))];

    console.log(` Returning ${finalContests.length} contests`);
    res.json({
      status: true,
      data: finalContests,
      totalResults: finalContests.length,
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

    // Calculate correct and wrong answers
    const answersArray = answers || [];
    const correctAnswers = answersArray.filter((a: any) => a.isCorrect === true).length;
    const wrongAnswers = answersArray.filter((a: any) => a.isCorrect === false && a.selectedAnswer && a.selectedAnswer.trim().length > 0).length;
    const totalQuestions = contest.questionCount || answersArray.length;

    // Calculate time taken (sum of all answer timeTaken values)
    const timeTaken = answersArray.reduce((total: number, a: any) => total + (a.timeTaken || 0), 0);

    // Calculate winning coins: +10 per correct, -5 per wrong, minimum 0
    const COINS_PER_CORRECT = 10;
    const COINS_PER_WRONG = 5;
    let winningAmount = (correctAnswers * COINS_PER_CORRECT) - (wrongAnswers * COINS_PER_WRONG);
    winningAmount = Math.max(0, winningAmount); // Ensure never negative

    // Update participation with results
    participation = await prisma.contestParticipation.update({
      where: { id: participation.id },
      data: {
        score: score || 0,
        answers: JSON.stringify(answersArray),
        completedAt: new Date(),
        coinsEarned: winningAmount,
      },
    });

    // Create PENDING coin history entry (coins will be awarded when results are announced)
    // Only for registered users (which is already ensured by isAuthenticated middleware)
    await prisma.coinHistory.create({
      data: {
        userId,
        amount: winningAmount,
        type: 'EARNED',
        status: 'PENDING', // Coins not yet awarded, waiting for result announcement
        description: `Quiz completed: ${contest.name}`,
        contestId,
        contestName: contest.name,
        correctAnswers,
        wrongAnswers,
        totalQuestions,
        winningAmount,
        timeTaken,
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
            coins: true,
          },
        },
      },
    });

    res.json({
      status: true,
      message: 'Contest results submitted successfully. Coins will be awarded when results are announced.',
      data: updatedParticipation,
      pendingCoins: winningAmount,
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

    // Determine user's country code
    // Priority: query param > cf-ipcountry header > IP geo lookup
    const queryCountry = req.query.country as string;
    const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
    const ipCountry = (req as any).clientCountryCode as string | undefined;
    let userCountry = 'ALL';
    if (queryCountry && queryCountry !== 'ALL') {
      userCountry = queryCountry.toUpperCase();
    } else if (cfCountry) {
      userCountry = cfCountry.toUpperCase();
    } else if (ipCountry && ipCountry !== 'ALL' && ipCountry !== 'UN') {
      userCountry = ipCountry;
    }

    // Transform all questions
    const allQuestions = contest.questions.map((q) => {
      let options: string[] = [];
      try {
        options = JSON.parse(q.options);
      } catch {
        options = [];
      }

      let qCountries: string[] = ['ALL'];
      try {
        qCountries = JSON.parse(q.countries);
      } catch {}

      return {
        id: q.id,
        question: q.question,
        type: q.type,
        media: q.media ? getImageUrl(q.media) : null,
        options,
        correctOption: q.correctOption,
        _countries: qCountries, // internal, stripped later
      };
    });

    // Strict priority question selection:
    // Country-specific questions take precedence; fall back to ALL if none exist
    let filtered = allQuestions as typeof allQuestions;
    if (userCountry !== 'ALL') {
      filtered = getApplicableQuestions(allQuestions, userCountry) as typeof allQuestions;
    }

    if (filtered.length === 0 && userCountry !== 'ALL') {
      return res.status(404).json({
        status: false,
        error: 'No questions available for your region',
      });
    }

    // Take up to questionCount questions
    const questionLimit = contest.questionCount || filtered.length;
    let questions = filtered.slice(0, questionLimit).map(({ _countries, ...rest }) => rest);

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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.contest.count({ where });

    const contests = await prisma.contest.findMany({
      where,
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
      skip,
      take: limit,
    });

    const transformedContests = contests.map((contest) => ({
      ...contest,
      imageUrl: getImageUrl(contest.imagePath),
      countries: (() => { try { return JSON.parse(contest.countries); } catch { return ['ALL']; } })(),
      status: contest.isDaily
        ? 'DAILY'
        : calculateStatus(contest.startDate || new Date(), contest.endDate || new Date(), contest.resultDate || new Date()),
    }));

    res.json({
      status: true,
      data: transformedContests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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
      countries: (() => { try { return JSON.parse(contest.countries); } catch { return ['ALL']; } })(),
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
      countries,
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

    // Contest countries are always inherited from the category
    let countriesJson = category.countries || '["ALL"]';
    // Ensure it's valid JSON
    try { JSON.parse(countriesJson); } catch { countriesJson = '["ALL"]'; }

    const contestData: any = {
      name,
      description: description || null,
      categoryId,
      imagePath: imagePath || 'uploads/contests/default.jpg',
      isDaily: isDaily || false,
      joiningFee: joiningFee !== undefined ? Math.max(0, parseInt(joiningFee.toString()) || 0) : 0,
      questionCount: questionCount || 10,
      duration: duration || 90,
      region: region || 'ALL', // Keep legacy field
      countries: countriesJson,
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
    // Contest countries are always inherited from the category
    // If category is changing, use the new category; otherwise use the current one
    const targetCategoryId = req.body.categoryId || contest.categoryId;
    const targetCategory = await prisma.category.findUnique({ where: { id: targetCategoryId } });
    if (targetCategory) {
      updateData.countries = targetCategory.countries || '["ALL"]';
      try { JSON.parse(updateData.countries); } catch { updateData.countries = '["ALL"]'; }
    }
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

// Announce contest results and award coins to all participants (admin only)
router.post('/contests/:id/announce-results', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get contest details
    const contest = await prisma.contest.findUnique({
      where: { id },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Find all PENDING coin history entries for this contest
    const pendingEntries = await prisma.coinHistory.findMany({
      where: {
        contestId: id,
        status: 'PENDING',
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

    if (pendingEntries.length === 0) {
      return res.json({
        status: true,
        message: 'No pending results to announce for this contest',
        processedCount: 0,
      });
    }

    // Process all pending entries in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let processedCount = 0;
      let totalCoinsAwarded = 0;

      for (const entry of pendingEntries) {
        // Award coins to the user
        await tx.user.update({
          where: { id: entry.userId },
          data: {
            coins: {
              increment: entry.amount,
            },
          },
        });

        // Update coin history status to COMPLETED
        await tx.coinHistory.update({
          where: { id: entry.id },
          data: {
            status: 'COMPLETED',
            description: `Coins awarded: ${contest.name}`,
          },
        });

        processedCount++;
        totalCoinsAwarded += entry.amount;
      }

      return { processedCount, totalCoinsAwarded };
    });

    res.json({
      status: true,
      message: `Results announced successfully! ${result.processedCount} participants received their coins.`,
      processedCount: result.processedCount,
      totalCoinsAwarded: result.totalCoinsAwarded,
      contestName: contest.name,
    });
  } catch (error: any) {
    console.error('Error announcing contest results:', error);
    res.status(500).json({ error: 'Failed to announce contest results' });
  }
});

// Get pending results for a contest (admin only)
router.get('/contests/:id/pending-results', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const pendingEntries = await prisma.coinHistory.findMany({
      where: {
        contestId: id,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            picture: true,
          },
        },
      },
      orderBy: {
        winningAmount: 'desc',
      },
    });

    res.json({
      status: true,
      data: pendingEntries,
      totalPending: pendingEntries.length,
      totalPendingCoins: pendingEntries.reduce((sum, e) => sum + e.amount, 0),
    });
  } catch (error: any) {
    console.error('Error fetching pending results:', error);
    res.status(500).json({ error: 'Failed to fetch pending results' });
  }
});

export default router;

