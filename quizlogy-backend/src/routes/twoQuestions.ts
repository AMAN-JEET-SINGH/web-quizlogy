import express, { Request, Response } from 'express';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import { getClientIP, getCountryFromIP } from '../middleware/ipTracking';
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

// Get random two questions for intro page (filtered by user country/region)
router.get('/random', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 2;
    const excludeIds = req.query.excludeIds ? (req.query.excludeIds as string).split(',').filter(id => id.trim() !== '') : [];

    // Determine user region: India (IND) sees only IND questions, others see only ALL questions
    // Prefer: query param (region=IND|ALL) -> cf-ipcountry header (IN -> IND) -> IP geo lookup
    const queryRegion = req.query.region as string;
    const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
    const ipGeo = getCountryFromIP(getClientIP(req));
    let userRegion: 'IND' | 'ALL' = 'ALL';
    if (queryRegion === 'IND' || queryRegion === 'ALL') {
      userRegion = queryRegion;
    } else if (cfCountry === 'IN') {
      userRegion = 'IND';
    } else {
      userRegion = (ipGeo.region === 'IND' ? 'IND' : 'ALL') as 'IND' | 'ALL';
    }

    // India users see only IND questions; other countries see only ALL questions
    const whereClause: any = {
      status: 'ACTIVE',
      region: userRegion,
    };

    if (excludeIds.length > 0) {
      whereClause.id = {
        notIn: excludeIds,
      };
    }

    let allQuestions = await prisma.twoQuestion.findMany({
      where: whereClause,
    });

    // If we've excluded all questions, reset and fetch from all questions (same region filter)
    if (allQuestions.length < count && excludeIds.length > 0) {
      allQuestions = await prisma.twoQuestion.findMany({
        where: {
          status: 'ACTIVE',
          region: userRegion,
        },
      });
    }

    if (allQuestions.length === 0) {
      return res.json({
        status: true,
        data: [],
        message: 'No questions available',
      });
    }

    // Shuffle and select random questions
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, Math.min(count, allQuestions.length));

    // Transform questions to match frontend expectations (options always strings for .trim() etc.)
    const transformedQuestions = selectedQuestions.map((q) => {
      let options: string[] = [];
      try {
        const parsed = JSON.parse(q.options);
        const arr = Array.isArray(parsed) ? parsed : [];
        options = arr.map((o: unknown) => (o != null ? String(o) : ''));
      } catch {
        options = [];
      }

      return {
        id: q.id,
        contestId: 'intro-quiz',
        question: q.question,
        type: q.type as 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO',
        media: q.media ? getImageUrl(q.media) : null,
        options: options,
        correctOption: q.correctOption != null ? String(q.correctOption) : q.correctOption,
        order: 0, // Not needed for intro questions
      };
    });

    res.json({
      status: true,
      data: transformedQuestions,
    });
  } catch (error) {
    console.error('Error fetching random two questions:', error);
    res.status(500).json({ error: 'Failed to fetch random questions' });
  }
});

// Get all two questions (admin only)
router.get('/', isAdmin, async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;

    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (search) {
      where.question = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    const questions = await prisma.twoQuestion.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const transformedQuestions = questions.map((q) => {
      let options: string[] = [];
      try {
        const parsed = JSON.parse(q.options);
        const arr = Array.isArray(parsed) ? parsed : [];
        options = arr.map((o: unknown) => (o != null ? String(o) : ''));
      } catch {
        options = [];
      }

      return {
        id: q.id,
        question: q.question,
        type: q.type,
        media: q.media ? getImageUrl(q.media) : null,
        options: options,
        correctOption: q.correctOption != null ? String(q.correctOption) : q.correctOption,
        status: q.status,
        region: q.region || 'ALL',
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      };
    });

    res.json({
      status: true,
      data: transformedQuestions,
      total: transformedQuestions.length,
    });
  } catch (error) {
    console.error('Error fetching two questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Delete multiple two questions (admin only)
router.post('/delete-many', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty' });
    }
    await prisma.twoQuestion.deleteMany({
      where: { id: { in: ids } },
    });
    res.json({
      status: true,
      message: `${ids.length} question(s) deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting two questions:', error);
    res.status(500).json({ error: 'Failed to delete questions' });
  }
});

// Get a single two question by ID (admin only)
router.get('/:id', isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const question = await prisma.twoQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    let options: string[] = [];
    try {
      const parsed = JSON.parse(question.options);
      const arr = Array.isArray(parsed) ? parsed : [];
      options = arr.map((o: unknown) => (o != null ? String(o) : ''));
    } catch {
      options = [];
    }

    res.json({
      status: true,
      data: {
        id: question.id,
        question: question.question,
        type: question.type,
        media: question.media ? getImageUrl(question.media) : null,
        options: options,
        correctOption: question.correctOption != null ? String(question.correctOption) : question.correctOption,
        status: question.status,
        region: question.region || 'ALL',
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching two question:', error);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

// Create a new two question (admin only)
router.post('/', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { question, type, media, options, correctOption, status, region } = req.body;

    if (!question || !options || !correctOption) {
      return res.status(400).json({ error: 'Missing required fields: question, options, correctOption' });
    }

    const validRegion = region === 'IND' ? 'IND' : 'ALL';

    // Validate options is an array or can be parsed as JSON
    let optionsArray: string[] = [];
    if (Array.isArray(options)) {
      optionsArray = options;
    } else if (typeof options === 'string') {
      try {
        optionsArray = JSON.parse(options);
        if (!Array.isArray(optionsArray)) {
          return res.status(400).json({ error: 'Options must be an array' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid options format. Must be JSON array' });
      }
    } else {
      return res.status(400).json({ error: 'Options must be an array' });
    }

    if (optionsArray.length < 2) {
      return res.status(400).json({ error: 'At least 2 options are required' });
    }

    // Normalize to strings so number vs string from Excel/JSON match (e.g. 0.25 === "0.25")
    const optionsAsStrings = optionsArray.map((o: unknown) => (o != null ? String(o) : ''));
    const correctOptionStr = correctOption != null ? String(correctOption) : '';
    if (!correctOptionStr || !optionsAsStrings.includes(correctOptionStr)) {
      return res.status(400).json({ error: 'Correct option must be one of the provided options' });
    }

    const newQuestion = await prisma.twoQuestion.create({
      data: {
        question,
        type: type || 'NONE',
        media: media || null,
        options: JSON.stringify(optionsAsStrings),
        correctOption: correctOptionStr,
        status: status || 'ACTIVE',
        region: validRegion,
      },
    });

    res.status(201).json({
      status: true,
      data: {
        id: newQuestion.id,
        question: newQuestion.question,
        type: newQuestion.type,
        media: newQuestion.media ? getImageUrl(newQuestion.media) : null,
        options: optionsAsStrings,
        correctOption: correctOptionStr,
        status: newQuestion.status,
        region: newQuestion.region || 'ALL',
        createdAt: newQuestion.createdAt,
        updatedAt: newQuestion.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating two question:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// Update a two question (admin only)
router.put('/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { question, type, media, options, correctOption, status, region } = req.body;

    // Check if question exists
    const existingQuestion = await prisma.twoQuestion.findUnique({
      where: { id },
    });

    if (!existingQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Prepare update data
    const updateData: any = {};

    if (question !== undefined) updateData.question = question;
    if (type !== undefined) updateData.type = type;
    if (media !== undefined) updateData.media = media || null;
    if (status !== undefined) updateData.status = status;
    if (region !== undefined) updateData.region = region === 'IND' ? 'IND' : 'ALL';

    // Handle options
    if (options !== undefined) {
      let optionsArray: string[] = [];
      if (Array.isArray(options)) {
        optionsArray = options;
      } else if (typeof options === 'string') {
        try {
          optionsArray = JSON.parse(options);
          if (!Array.isArray(optionsArray)) {
            return res.status(400).json({ error: 'Options must be an array' });
          }
        } catch {
          return res.status(400).json({ error: 'Invalid options format. Must be JSON array' });
        }
      } else {
        return res.status(400).json({ error: 'Options must be an array' });
      }

      if (optionsArray.length < 2) {
        return res.status(400).json({ error: 'At least 2 options are required' });
      }

      const optionsAsStrings = optionsArray.map((o: unknown) => (o != null ? String(o) : ''));
      updateData.options = JSON.stringify(optionsAsStrings);

      // Validate correctOption if provided (compare as strings so number vs "0.25" match)
      if (correctOption !== undefined) {
        const correctOptionStr = correctOption != null ? String(correctOption) : '';
        if (!correctOptionStr || !optionsAsStrings.includes(correctOptionStr)) {
          return res.status(400).json({ error: 'Correct option must be one of the provided options' });
        }
        updateData.correctOption = correctOptionStr;
      } else if (existingQuestion.correctOption) {
        const existingStr = String(existingQuestion.correctOption);
        if (!optionsAsStrings.includes(existingStr)) {
          return res.status(400).json({ error: 'Current correct option is not in the new options list' });
        }
      }
    } else if (correctOption !== undefined) {
      let currentOptions: string[] = [];
      try {
        const parsed = JSON.parse(existingQuestion.options);
        const arr = Array.isArray(parsed) ? parsed : [];
        currentOptions = arr.map((o: unknown) => (o != null ? String(o) : ''));
      } catch {
        return res.status(400).json({ error: 'Invalid existing options format' });
      }
      const correctOptionStr = correctOption != null ? String(correctOption) : '';
      if (!correctOptionStr || !currentOptions.includes(correctOptionStr)) {
        return res.status(400).json({ error: 'Correct option must be one of the existing options' });
      }
      updateData.correctOption = correctOptionStr;
    }

    const updatedQuestion = await prisma.twoQuestion.update({
      where: { id },
      data: updateData,
    });

    let optionsArray: string[] = [];
    try {
      optionsArray = JSON.parse(updatedQuestion.options);
    } catch {
      optionsArray = [];
    }

    res.json({
      status: true,
      data: {
        id: updatedQuestion.id,
        question: updatedQuestion.question,
        type: updatedQuestion.type,
        media: updatedQuestion.media ? getImageUrl(updatedQuestion.media) : null,
        options: optionsArray,
        correctOption: updatedQuestion.correctOption,
        status: updatedQuestion.status,
        region: updatedQuestion.region || 'ALL',
        createdAt: updatedQuestion.createdAt,
        updatedAt: updatedQuestion.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating two question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete a two question (admin only)
router.delete('/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const question = await prisma.twoQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    await prisma.twoQuestion.delete({
      where: { id },
    });

    res.json({
      status: true,
      message: 'Question deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting two question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

export default router;


