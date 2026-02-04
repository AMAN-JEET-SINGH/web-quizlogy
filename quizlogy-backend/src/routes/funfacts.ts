import express, { Request, Response } from 'express';
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

// Get all funfacts
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    
    const where: any = {};
    if (status === 'ACTIVE' || status === 'INACTIVE') {
      where.status = status;
    }
    // If no status filter, return all funfacts

    const funfacts = await prisma.funFact.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get question counts for each funfact
    const funfactIds = funfacts.map(f => f.id);
    const questionCounts = await prisma.funFactQuestion.groupBy({
      by: ['funFactId'],
      where: {
        funFactId: { in: funfactIds },
      },
      _count: {
        id: true,
      },
    });

    const countMap = new Map(questionCounts.map(qc => [qc.funFactId, qc._count.id]));

    const transformedFunfacts = funfacts.map((funfact) => ({
      id: funfact.id,
      title: funfact.title,
      description: funfact.description,
      imagePath: funfact.imagePath,
      imageUrl: funfact.imagePath ? getImageUrl(funfact.imagePath) : null,
      status: funfact.status,
      questionCount: countMap.get(funfact.id) || 0,
      createdAt: funfact.createdAt,
      updatedAt: funfact.updatedAt,
    }));

    res.json({
      status: true,
      data: transformedFunfacts,
    });
  } catch (error) {
    console.error('Error fetching funfacts:', error);
    res.status(500).json({ error: 'Failed to fetch funfacts' });
  }
});

// Get all funfact questions (standalone, not tied to specific funfact)
// IMPORTANT: These routes must come BEFORE /:id and /:funfactId routes to avoid conflicts
router.get('/questions/all', async (req: Request, res: Response) => {
  try {
    const { type, search } = req.query;
    const where: any = {};

    if (type) where.type = type as string;
    if (search) {
      where.question = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    const questions = await prisma.funFactQuestion.findMany({
      where,
      include: {
        funFact: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const transformedQuestions = questions.map((q) => {
      let options: string[] = [];
      try {
        options = JSON.parse(q.options);
      } catch {
        options = [];
      }

      return {
        id: q.id,
        funFactId: q.funFactId,
        question: q.question,
        type: q.type,
        media: q.media ? getImageUrl(q.media) : null,
        options,
        correctOption: q.correctOption,
        order: q.order,
        funFact: q.funFact ? {
          id: q.funFact.id,
          title: q.funFact.title,
          status: q.funFact.status,
        } : null,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      };
    });

    res.json({
      status: true,
      data: transformedQuestions,
    });
  } catch (error) {
    console.error('Error fetching all funfact questions:', error);
    res.status(500).json({ error: 'Failed to fetch funfact questions' });
  }
});

// Create funfact question (admin only) - standalone, funFactId is optional
// IMPORTANT: This route must come BEFORE /:funfactId/questions to avoid route conflicts
router.post('/questions/create', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { funFactId, question, type, media, options, correctOption, order } = req.body;

    if (!question || !options || !correctOption) {
      return res.status(400).json({
        error: 'Missing required fields: question, options, correctOption are required',
      });
    }

    // If funFactId is provided, validate it exists
    if (funFactId) {
      const funfact = await prisma.funFact.findUnique({
        where: { id: funFactId },
      });

      if (!funfact) {
        return res.status(404).json({ error: 'Funfact not found' });
      }
    }

    // Validate options is array
    const optionsArray = Array.isArray(options) ? options : JSON.parse(options || '[]');
    
    // Filter out empty options - handle both strings and numbers
    const validOptions = optionsArray.filter((opt: any) => {
      if (typeof opt === 'string') {
        return opt.trim().length > 0;
      }
      if (typeof opt === 'number') {
        return true; // Numbers are valid options
      }
      return false;
    });
    
    if (validOptions.length < 2) {
      return res.status(400).json({ error: 'Options must contain at least 2 non-empty items' });
    }

    // Ensure we have exactly 4 options (pad with empty strings if needed)
    const finalOptions = [...optionsArray];
    while (finalOptions.length < 4) {
      finalOptions.push('');
    }
    if (finalOptions.length > 4) {
      finalOptions.splice(4);
    }

    // Validate correctOption is in valid options (compare as strings so Excel number vs "0.25" match)
    const optionsAsStrings = validOptions.map((o: any) => (o != null ? String(o) : ''));
    const correctOptionStr = correctOption != null ? String(correctOption) : '';
    if (!correctOptionStr || !optionsAsStrings.includes(correctOptionStr)) {
      return res.status(400).json({ error: 'correctOption must be one of the provided options' });
    }

    // Create a dummy fun fact if none exists for standalone questions
    let finalFunFactId = funFactId;
    if (!finalFunFactId) {
      // Find or create a default "Standalone" fun fact for questions not tied to any fun fact
      let standaloneFunFact = await prisma.funFact.findFirst({
        where: { title: 'Standalone Questions' },
      });
      
      if (!standaloneFunFact) {
        standaloneFunFact = await prisma.funFact.create({
          data: {
            title: 'Standalone Questions',
            description: 'Default fun fact for standalone questions',
            status: 'INACTIVE',
          },
        });
      }
      finalFunFactId = standaloneFunFact.id;
    }

    let questionOrder = order;
    if (!questionOrder) {
      const lastQuestion = await prisma.funFactQuestion.findFirst({
        where: finalFunFactId ? { funFactId: finalFunFactId } : {},
        orderBy: { order: 'desc' },
      });
      questionOrder = lastQuestion ? lastQuestion.order + 1 : 1;
    }

    const createdQuestion = await prisma.funFactQuestion.create({
      data: {
        funFactId: finalFunFactId,
        question,
        type: type || 'NONE',
        media: media || null,
        options: JSON.stringify(finalOptions),
        correctOption: correctOptionStr,
        order: questionOrder,
      },
    });

    let parsedOptions: string[] = [];
    try {
      parsedOptions = JSON.parse(createdQuestion.options);
    } catch {}

    res.status(201).json({
      id: createdQuestion.id,
      funFactId: createdQuestion.funFactId,
      question: createdQuestion.question,
      type: createdQuestion.type,
      media: createdQuestion.media ? getImageUrl(createdQuestion.media) : null,
      options: parsedOptions,
      correctOption: createdQuestion.correctOption,
      order: createdQuestion.order,
    });
  } catch (error) {
    console.error('Error creating funfact question:', error);
    res.status(500).json({ error: 'Failed to create funfact question' });
  }
});

// Get funfact by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const funfact = await prisma.funFact.findUnique({
      where: { id },
    });

    if (!funfact) {
      return res.status(404).json({ error: 'Funfact not found' });
    }

    res.json({
      status: true,
      data: {
        id: funfact.id,
        title: funfact.title,
        description: funfact.description,
        imagePath: funfact.imagePath,
        imageUrl: funfact.imagePath ? getImageUrl(funfact.imagePath) : null,
        status: funfact.status,
        createdAt: funfact.createdAt,
        updatedAt: funfact.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching funfact:', error);
    res.status(500).json({ error: 'Failed to fetch funfact' });
  }
});

// Create funfact (admin only)
router.post('/', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { title, description, imagePath, status } = req.body;

    if (!title) {
      return res.status(400).json({
        error: 'Missing required fields: title is required',
      });
    }

    const funfact = await prisma.funFact.create({
      data: {
        title,
        description: description || null,
        imagePath: imagePath || null,
        status: status || 'ACTIVE',
      },
    });

    res.status(201).json({
      id: funfact.id,
      title: funfact.title,
      description: funfact.description,
      imageUrl: funfact.imagePath ? getImageUrl(funfact.imagePath) : null,
      status: funfact.status,
    });
  } catch (error) {
    console.error('Error creating funfact:', error);
    res.status(500).json({ error: 'Failed to create funfact' });
  }
});

// Update funfact (admin only)
router.put('/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: any = {};

    const funfact = await prisma.funFact.findUnique({
      where: { id },
    });

    if (!funfact) {
      return res.status(404).json({ error: 'Funfact not found' });
    }

    if (req.body.title) updateData.title = req.body.title;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.imagePath !== undefined) updateData.imagePath = req.body.imagePath;
    if (req.body.status) updateData.status = req.body.status;

    const updatedFunfact = await prisma.funFact.update({
      where: { id },
      data: updateData,
    });

    res.json({
      id: updatedFunfact.id,
      title: updatedFunfact.title,
      description: updatedFunfact.description,
      imageUrl: updatedFunfact.imagePath ? getImageUrl(updatedFunfact.imagePath) : null,
      status: updatedFunfact.status,
    });
  } catch (error) {
    console.error('Error updating funfact:', error);
    res.status(500).json({ error: 'Failed to update funfact' });
  }
});

// Delete funfact (admin only)
router.delete('/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const funfact = await prisma.funFact.findUnique({
      where: { id },
    });

    if (!funfact) {
      return res.status(404).json({ error: 'Funfact not found' });
    }

    await prisma.funFact.delete({
      where: { id },
    });

    res.json({ message: 'Funfact deleted successfully' });
  } catch (error) {
    console.error('Error deleting funfact:', error);
    res.status(500).json({ error: 'Failed to delete funfact' });
  }
});

// Get funfact questions for a specific funfact
router.get('/:funfactId/questions', async (req: Request, res: Response) => {
  try {
    const { funfactId } = req.params;

    const questions = await prisma.funFactQuestion.findMany({
      where: { funFactId: funfactId },
      orderBy: {
        order: 'asc',
      },
    });

    const transformedQuestions = questions.map((q) => {
      let options: string[] = [];
      try {
        options = JSON.parse(q.options);
      } catch {
        options = [];
      }

      return {
        id: q.id,
        funFactId: q.funFactId,
        question: q.question,
        type: q.type,
        media: q.media ? getImageUrl(q.media) : null,
        options,
        correctOption: q.correctOption,
        order: q.order,
      };
    });

    res.json({
      status: true,
      data: transformedQuestions,
    });
  } catch (error) {
    console.error('Error fetching funfact questions:', error);
    res.status(500).json({ error: 'Failed to fetch funfact questions' });
  }
});

// Update funfact question (admin only)
router.put('/questions/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: any = {};

    const question = await prisma.funFactQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      return res.status(404).json({ error: 'Funfact question not found' });
    }

    if (req.body.question) updateData.question = req.body.question;
    if (req.body.type) updateData.type = req.body.type;
    if (req.body.media !== undefined) updateData.media = req.body.media;
    if (req.body.options) {
      const optionsArray = Array.isArray(req.body.options) 
        ? req.body.options 
        : JSON.parse(req.body.options || '[]');
      
      // Filter out empty options for validation - handle both strings and numbers
      const validOptions = optionsArray.filter((opt: any) => {
        if (typeof opt === 'string') {
          return opt.trim().length > 0;
        }
        if (typeof opt === 'number') {
          return true; // Numbers are valid options
        }
        return false;
      });
      
      if (validOptions.length < 2) {
        return res.status(400).json({ error: 'Options must contain at least 2 non-empty items' });
      }

      // Ensure we have exactly 4 options (pad with empty strings if needed)
      const finalOptions = [...optionsArray];
      while (finalOptions.length < 4) {
        finalOptions.push('');
      }
      if (finalOptions.length > 4) {
        finalOptions.splice(4);
      }

      // Validate correctOption if provided (compare as strings)
      const optionsAsStrings = validOptions.map((o: any) => (o != null ? String(o) : ''));
      const correctOptionStr = req.body.correctOption != null ? String(req.body.correctOption) : '';
      if (correctOptionStr && !optionsAsStrings.includes(correctOptionStr)) {
        return res.status(400).json({ error: 'correctOption must be one of the provided options' });
      }

      updateData.options = JSON.stringify(finalOptions);
    }
    if (req.body.correctOption !== undefined) updateData.correctOption = req.body.correctOption != null ? String(req.body.correctOption) : req.body.correctOption;
    if (req.body.order !== undefined) updateData.order = req.body.order;

    const updatedQuestion = await prisma.funFactQuestion.update({
      where: { id },
      data: updateData,
    });

    let parsedOptions: string[] = [];
    try {
      parsedOptions = JSON.parse(updatedQuestion.options);
    } catch {}

    res.json({
      id: updatedQuestion.id,
      funFactId: updatedQuestion.funFactId,
      question: updatedQuestion.question,
      type: updatedQuestion.type,
      media: updatedQuestion.media ? getImageUrl(updatedQuestion.media) : null,
      options: parsedOptions,
      correctOption: updatedQuestion.correctOption,
      order: updatedQuestion.order,
    });
  } catch (error) {
    console.error('Error updating funfact question:', error);
    res.status(500).json({ error: 'Failed to update funfact question' });
  }
});

// Delete funfact question (admin only)
router.delete('/questions/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const question = await prisma.funFactQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      return res.status(404).json({ error: 'Funfact question not found' });
    }

    await prisma.funFactQuestion.delete({
      where: { id },
    });

    res.json({ message: 'Funfact question deleted successfully' });
  } catch (error) {
    console.error('Error deleting funfact question:', error);
    res.status(500).json({ error: 'Failed to delete funfact question' });
  }
});

export default router;

