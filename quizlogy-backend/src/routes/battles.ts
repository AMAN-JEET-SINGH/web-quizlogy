import express, { Request, Response } from 'express';
import { isAuthenticated, AuthRequest } from '../middleware/auth';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import prisma from '../config/database';

const router = express.Router();

// Helper function to get image URL based on environment
function getImageUrl(imagePath: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.IMAGE_BASE_URL || 'http://localhost:5001';
  const digitalOceanUrl = process.env.DIGITAL_OCEAN_IMAGE_URL;

  // Default placeholder image
  if (!imagePath || imagePath === 'default' || imagePath === 'placeholder' || imagePath.trim() === '') {
    return `${baseUrl}/uploads/placeholder.jpg`;
  }

  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // If it starts with uploads/, it's an uploaded file
  if (imagePath.startsWith('uploads/')) {
    if (isProduction && digitalOceanUrl) {
      return `${digitalOceanUrl}/${imagePath}`;
    } else {
      return `${baseUrl}/${imagePath}`;
    }
  }

  // Otherwise, treat as regular asset path
  if (isProduction && digitalOceanUrl) {
    return `${digitalOceanUrl}/${imagePath}`;
  } else {
    return `${baseUrl}/${imagePath}`;
  }
}

// IMPORTANT: Specific routes must come BEFORE parameterized routes (/:id)
// Get all battles (admin only - for admin panel) - MUST come before /battles/:id
router.get('/battles/admin', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const battles = await prisma.battle.findMany({
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const battlesWithImageUrl = battles.map((battle) => ({
      ...battle,
      imageUrl: getImageUrl(battle.imagePath),
    }));

    res.json(battlesWithImageUrl);
  } catch (error) {
    console.error('Error fetching battles:', error);
    res.status(500).json({ error: 'Failed to fetch battles' });
  }
});

// Get single battle by ID (admin only - for admin panel) - MUST come before /battles/:id
router.get('/battles/:id/admin', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const battle = await prisma.battle.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    res.json({
      ...battle,
      imageUrl: getImageUrl(battle.imagePath),
    });
  } catch (error) {
    console.error('Error fetching battle:', error);
    res.status(500).json({ error: 'Failed to fetch battle' });
  }
});

// Get all battles (public - for frontend)
router.get('/battles', async (req: Request, res: Response) => {
  try {
    console.log('📥 GET /api/battles - Request received');
    const { status } = req.query;
    console.log('Query params:', { status });
    
    const where: any = {};
    if (status) {
      where.status = status;
    }

    console.log('Database query where clause:', where);

    const battles = await prisma.battle.findMany({
      where,
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`✅ Found ${battles.length} battles`);

    const battlesWithImageUrl = battles.map((battle) => ({
      ...battle,
      imageUrl: getImageUrl(battle.imagePath),
    }));

    const response = {
      status: true,
      data: battlesWithImageUrl,
    };

    console.log('📤 Returning battles response:', { 
      status: response.status, 
      count: response.data.length 
    });

    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching battles:', error);
    res.status(500).json({ error: 'Failed to fetch battles' });
  }
});

// Get single battle by ID (public - for frontend)
router.get('/battles/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const battle = await prisma.battle.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    res.json({
      status: true,
      data: {
        ...battle,
        imageUrl: getImageUrl(battle.imagePath),
      },
    });
  } catch (error) {
    console.error('Error fetching battle:', error);
    res.status(500).json({ error: 'Failed to fetch battle' });
  }
});

// Create battle (admin only)
router.post('/battles', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { name, description, imagePath, backgroundColorTop, backgroundColorBottom, status } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        error: 'Missing required fields: name is required',
      });
    }

    // Use a default path for database (getImageUrl will return placeholder for default/placeholder)
    const finalImagePath = imagePath || 'uploads/categories/default.jpg';

    // Validate status - convert to uppercase
    let validStatus = 'ACTIVE';
    if (status) {
      const statusUpper = status.toString().toUpperCase();
      validStatus = statusUpper === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    const battle = await prisma.battle.create({
      data: {
        name,
        description: description || null,
        imagePath: finalImagePath,
        backgroundColorTop: backgroundColorTop || null,
        backgroundColorBottom: backgroundColorBottom || null,
        status: validStatus,
      },
    });

    res.status(201).json({
      ...battle,
      imageUrl: getImageUrl(battle.imagePath),
    });
  } catch (error) {
    console.error('Error creating battle:', error);
    res.status(500).json({ error: 'Failed to create battle' });
  }
});

// Update battle (admin only)
router.put('/battles/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, imagePath, backgroundColorTop, backgroundColorBottom, status } = req.body;

    // Check if battle exists
    const existingBattle = await prisma.battle.findUnique({
      where: { id },
    });

    if (!existingBattle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Validate status - convert to uppercase
    let validStatus = existingBattle.status;
    if (status) {
      const statusUpper = status.toString().toUpperCase();
      validStatus = statusUpper === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    const battle = await prisma.battle.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(imagePath && { imagePath }),
        ...(backgroundColorTop !== undefined && { backgroundColorTop: backgroundColorTop || null }),
        ...(backgroundColorBottom !== undefined && { backgroundColorBottom: backgroundColorBottom || null }),
        status: validStatus,
      },
    });

    res.json({
      ...battle,
      imageUrl: getImageUrl(battle.imagePath),
    });
  } catch (error) {
    console.error('Error updating battle:', error);
    res.status(500).json({ error: 'Failed to update battle' });
  }
});

// Delete battle (admin only)
router.delete('/battles/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if battle exists
    const existingBattle = await prisma.battle.findUnique({
      where: { id },
    });

    if (!existingBattle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Delete battle (cascade will delete questions)
    await prisma.battle.delete({
      where: { id },
    });

    res.json({ message: 'Battle deleted successfully' });
  } catch (error) {
    console.error('Error deleting battle:', error);
    res.status(500).json({ error: 'Failed to delete battle' });
  }
});

// ========== Battle Questions Routes ==========
// IMPORTANT: Specific routes must come BEFORE parameterized routes

// Get battle questions (admin only - for admin panel) - MUST come before /battles/:battleId/questions/:id
router.get('/battles/:battleId/questions/admin', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { battleId } = req.params;

    const questions = await prisma.battleQuestion.findMany({
      where: { battleId },
      orderBy: { order: 'asc' },
    });

    res.json(questions);
  } catch (error) {
    console.error('Error fetching battle questions:', error);
    res.status(500).json({ error: 'Failed to fetch battle questions' });
  }
});

// Get battle questions (public - for frontend)
router.get('/battles/:battleId/questions', async (req: Request, res: Response) => {
  try {
    const { battleId } = req.params;

    const questions = await prisma.battleQuestion.findMany({
      where: { battleId },
      orderBy: { order: 'asc' },
    });

    res.json({
      status: true,
      data: questions,
    });
  } catch (error) {
    console.error('Error fetching battle questions:', error);
    res.status(500).json({ error: 'Failed to fetch battle questions' });
  }
});

// Get single battle question by ID (admin only)
router.get('/battles/:battleId/questions/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const question = await prisma.battleQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      return res.status(404).json({ error: 'Battle question not found' });
    }

    res.json(question);
  } catch (error) {
    console.error('Error fetching battle question:', error);
    res.status(500).json({ error: 'Failed to fetch battle question' });
  }
});

// Create battle question (admin only)
router.post('/battles/:battleId/questions', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { battleId } = req.params;
    const { category, question, type, media, options, correctOption, order } = req.body;

    // Validation
    if (!category || !question || !options || !correctOption) {
      return res.status(400).json({
        error: 'Missing required fields: category, question, options, and correctOption are required',
      });
    }

    // Validate options is a JSON array
    let optionsArray: any[];
    try {
      optionsArray = typeof options === 'string' ? JSON.parse(options) : options;
      if (!Array.isArray(optionsArray) || optionsArray.length !== 4) {
        return res.status(400).json({ error: 'Options must be an array of 4 items' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid options format. Must be a JSON array' });
    }

    // Normalize to strings so Excel number vs "0.25" match
    const optionsAsStrings = optionsArray.map((o: any) => (o != null ? String(o) : ''));
    const correctOptionStr = correctOption != null ? String(correctOption) : '';
    if (!correctOptionStr || !optionsAsStrings.includes(correctOptionStr)) {
      return res.status(400).json({ error: 'Correct option must be one of the provided options' });
    }

    // Check if battle exists
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
    });

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Get max order if order not provided
    let questionOrder = order;
    if (questionOrder === undefined || questionOrder === null) {
      const maxOrder = await prisma.battleQuestion.findFirst({
        where: { battleId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      questionOrder = maxOrder ? maxOrder.order + 1 : 1;
    }

    const battleQuestion = await prisma.battleQuestion.create({
      data: {
        battleId,
        category,
        question,
        type: type || 'NONE',
        media: media || null,
        options: JSON.stringify(optionsAsStrings),
        correctOption: correctOptionStr,
        order: questionOrder,
      },
    });

    res.status(201).json(battleQuestion);
  } catch (error) {
    console.error('Error creating battle question:', error);
    res.status(500).json({ error: 'Failed to create battle question' });
  }
});

// Update battle question (admin only)
router.put('/battles/:battleId/questions/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { category, question, type, media, options, correctOption, order } = req.body;

    // Check if question exists
    const existingQuestion = await prisma.battleQuestion.findUnique({
      where: { id },
    });

    if (!existingQuestion) {
      return res.status(404).json({ error: 'Battle question not found' });
    }

    // Validate options if provided
    let optionsArray: any[] | undefined;
    let optionsAsStrings: string[] | undefined;
    if (options) {
      try {
        optionsArray = typeof options === 'string' ? JSON.parse(options) : options;
        if (!Array.isArray(optionsArray) || optionsArray.length !== 4) {
          return res.status(400).json({ error: 'Options must be an array of 4 items' });
        }
        optionsAsStrings = optionsArray.map((o: any) => (o != null ? String(o) : ''));
      } catch (e) {
        return res.status(400).json({ error: 'Invalid options format. Must be a JSON array' });
      }

      const correctOptionStr = correctOption != null ? String(correctOption) : '';
      if (correctOptionStr && (!optionsAsStrings || !optionsAsStrings.includes(correctOptionStr))) {
        return res.status(400).json({ error: 'Correct option must be one of the provided options' });
      }
    }

    const battleQuestion = await prisma.battleQuestion.update({
      where: { id },
      data: {
        ...(category && { category }),
        ...(question && { question }),
        ...(type !== undefined && { type }),
        ...(media !== undefined && { media: media || null }),
        ...(optionsAsStrings && { options: JSON.stringify(optionsAsStrings) }),
        ...(correctOption !== undefined && { correctOption: correctOption != null ? String(correctOption) : correctOption }),
        ...(order !== undefined && { order }),
      },
    });

    res.json(battleQuestion);
  } catch (error) {
    console.error('Error updating battle question:', error);
    res.status(500).json({ error: 'Failed to update battle question' });
  }
});

// Delete battle question (admin only)
router.delete('/battles/:battleId/questions/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if question exists
    const existingQuestion = await prisma.battleQuestion.findUnique({
      where: { id },
    });

    if (!existingQuestion) {
      return res.status(404).json({ error: 'Battle question not found' });
    }

    await prisma.battleQuestion.delete({
      where: { id },
    });

    res.json({ message: 'Battle question deleted successfully' });
  } catch (error) {
    console.error('Error deleting battle question:', error);
    res.status(500).json({ error: 'Failed to delete battle question' });
  }
});

export default router;
