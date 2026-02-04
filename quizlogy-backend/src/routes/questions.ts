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

// Get all questions with filtering (admin only)
router.get('/', isAdmin, async (req: Request, res: Response) => {
  try {
    const { categoryId, contestId, type, region, level, search } = req.query;

    const where: any = {};

    if (contestId) {
      where.contestId = contestId as string;
    }

    if (type && type !== 'ALL') {
      where.type = type as string;
    }

    // If categoryId is provided, filter by contest category
    if (categoryId) {
      const contests = await prisma.contest.findMany({
        where: { categoryId: categoryId as string },
        select: { id: true },
      });
      where.contestId = { in: contests.map(c => c.id) };
    }

    // Search by question text
    if (search) {
      where.question = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        contest: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const transformedQuestions = questions.map((q) => {
      let options: any[] = [];
      try {
        const parsed = JSON.parse(q.options);
        // Parse each option - might be string or object
        options = parsed.map((opt: any) => {
          if (typeof opt === 'string') {
            try {
              // Try to parse if it's a JSON string
              const innerParsed = JSON.parse(opt);
              if (innerParsed.text || innerParsed.image) {
                return {
                  text: innerParsed.text || '',
                  image: innerParsed.image ? getImageUrl(innerParsed.image) : '',
                };
              }
            } catch {
              // Not JSON, treat as plain text
            }
            return { text: opt, image: '' };
          }
          return { text: opt.text || opt, image: opt.image ? getImageUrl(opt.image) : '' };
        });
      } catch {
        options = [];
      }

      return {
        id: q.id,
        contestId: q.contestId,
        contest: q.contest ? {
          id: q.contest.id,
          name: q.contest.name,
          category: q.contest.category,
          region: q.contest.region,
        } : null,
        question: q.question,
        type: q.type,
        media: q.media ? getImageUrl(q.media) : null,
        options,
        correctOption: q.correctOption,
        order: q.order,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      };
    });

    // Filter by region if provided (filter by contest region)
    let filteredQuestions = transformedQuestions;
    if (region && region !== 'ALL') {
      filteredQuestions = transformedQuestions.filter(q => 
        q.contest && q.contest.region === region
      );
    }

    res.json({
      status: true,
      data: filteredQuestions,
      total: filteredQuestions.length,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Get random questions (for intro page)
router.get('/random', async (req: Request, res: Response) => {
  try {
    const { count = 2 } = req.query;
    const questionCount = parseInt(count as string, 10) || 2;

    // Get all questions
    const allQuestions = await prisma.question.findMany({});

    if (allQuestions.length === 0) {
      return res.json({
        status: true,
        data: [],
      });
    }

    // Filter questions to only include those with exactly 4 valid options
    const questionsWith4Options = allQuestions.filter((q) => {
      try {
        const parsed = JSON.parse(q.options);
        if (!Array.isArray(parsed)) return false;
        
        // Count valid (non-empty) options
        const validOptions = parsed.filter((opt: any) => {
          if (typeof opt === 'string') {
            // Check if it's a JSON string
            try {
              const innerParsed = JSON.parse(opt);
              return (innerParsed.text && innerParsed.text.trim()) || (innerParsed.image && innerParsed.image.trim());
            } catch {
              return opt && opt.trim();
            }
          }
          // If it's an object
          return (opt.text && opt.text.trim()) || (opt.image && opt.image.trim());
        });
        
        return validOptions.length === 4;
      } catch {
        return false;
      }
    });

    if (questionsWith4Options.length === 0) {
      return res.json({
        status: true,
        data: [],
      });
    }

    // Shuffle and take random questions
    const shuffled = questionsWith4Options.sort(() => Math.random() - 0.5);
    const randomQuestions = shuffled.slice(0, Math.min(questionCount, questionsWith4Options.length));

    const transformedQuestions = randomQuestions.map((q) => {
      let options: any[] = [];
      try {
        const parsed = JSON.parse(q.options);
        // Parse each option - might be string or object
        options = parsed.map((opt: any) => {
          if (typeof opt === 'string') {
            try {
              // Try to parse if it's a JSON string
              const innerParsed = JSON.parse(opt);
              if (innerParsed.text || innerParsed.image) {
                return {
                  text: innerParsed.text || '',
                  image: innerParsed.image ? getImageUrl(innerParsed.image) : '',
                };
              }
            } catch {
              // Not JSON, treat as plain text
            }
            return { text: opt, image: '' };
          }
          return { text: opt.text || opt, image: opt.image ? getImageUrl(opt.image) : '' };
        });
      } catch {
        options = [];
      }

      // Extract text from options for correctOption matching - ensure all are strings
      const optionTexts = options.map(opt => {
        if (typeof opt === 'string') return opt;
        if (opt && typeof opt === 'object') {
          return opt.text || String(opt);
        }
        return String(opt || '');
      });
      
      // Find the matching correctOption text from the transformed options
      // The correctOption in DB might match the option text or be stored as-is
      let correctOptionText = q.correctOption;
      if (typeof correctOptionText !== 'string') {
        correctOptionText = String(correctOptionText || '');
      }
      
      for (const opt of options) {
        const optText = typeof opt === 'string' ? opt : (opt?.text || String(opt || ''));
        const optImage = opt?.image || '';
        // Check if correctOption matches this option's text or image
        if (optText === correctOptionText || optImage === correctOptionText) {
          correctOptionText = optText;
          break;
        }
      }

      return {
        id: q.id,
        contestId: q.contestId,
        question: q.question,
        type: q.type,
        media: q.media ? getImageUrl(q.media) : null,
        options: optionTexts, // Return as simple array of strings for easier frontend use
        correctOption: correctOptionText,
        order: q.order,
      };
    });

    res.json({
      status: true,
      data: transformedQuestions,
    });
  } catch (error) {
    console.error('Error fetching random questions:', error);
    res.status(500).json({ error: 'Failed to fetch random questions' });
  }
});

// Get questions for a contest
router.get('/contest/:contestId', async (req: Request, res: Response) => {
  try {
    const { contestId } = req.params;

    const questions = await prisma.question.findMany({
      where: { contestId },
      orderBy: {
        order: 'asc',
      },
    });

    const transformedQuestions = questions.map((q) => {
      let options: any[] = [];
      try {
        const parsed = JSON.parse(q.options);
        // Parse each option - might be string or object
        options = parsed.map((opt: any) => {
          if (typeof opt === 'string') {
            try {
              // Try to parse if it's a JSON string
              const innerParsed = JSON.parse(opt);
              if (innerParsed.text || innerParsed.image) {
                return {
                  text: innerParsed.text || '',
                  image: innerParsed.image ? getImageUrl(innerParsed.image) : '',
                };
              }
            } catch {
              // Not JSON, treat as plain text
            }
            return { text: opt, image: '' };
          }
          return { text: opt.text || opt, image: opt.image ? getImageUrl(opt.image) : '' };
        });
      } catch {
        options = [];
      }

      return {
        id: q.id,
        contestId: q.contestId,
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
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Create question for contest (admin only)
router.post('/contest/:contestId', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { contestId } = req.params;
    const { question, type, media, options, correctOption, order } = req.body;

    // Validation
    if (!question || !options || !correctOption) {
      return res.status(400).json({
        error: 'Missing required fields: question, options, correctOption are required',
      });
    }

    // Validate contest exists
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    // Validate options is array
    let optionsArray = Array.isArray(options) ? options : JSON.parse(options || '[]');
    
    // Ensure all options are properly formatted - convert numbers to strings if needed
    const parsedOptions = optionsArray.map((opt: any) => {
      // Handle null/undefined
      if (opt === null || opt === undefined) {
        return '';
      }
      
      // Handle numbers - convert to string to preserve them
      if (typeof opt === 'number') {
        return String(opt); // Convert number to string (e.g., 1 -> "1")
      }
      
      if (typeof opt === 'string') {
        // Try to parse if it's a JSON string
        try {
          const parsed = JSON.parse(opt);
          if (parsed && typeof parsed === 'object' && (parsed.text || parsed.image)) {
            return opt; // Keep as JSON string if it's an object
          }
        } catch {
          // Not JSON, treat as plain text - return as is
        }
        return opt;
      }
      
      // If it's already an object, stringify it
      if (typeof opt === 'object' && opt !== null && (opt.text || opt.image)) {
        return JSON.stringify(opt);
      }
      
      // Convert anything else to string
      return String(opt);
    });
    
    // Filter out empty options (check both text strings and objects)
    const validOptions = parsedOptions.filter((opt: any) => {
      // Handle null or undefined
      if (opt === null || opt === undefined) {
        return false;
      }
      
      // Handle numbers (including 0)
      if (typeof opt === 'number') {
        return true; // All numbers are valid options, including 0
      }
      
      // Handle strings
      if (typeof opt === 'string') {
        // Try to parse as JSON first (for complex objects)
        try {
          const parsed = JSON.parse(opt);
          if (typeof parsed === 'object' && parsed !== null) {
            return (parsed.text && String(parsed.text).trim()) || (parsed.image && String(parsed.image).trim());
          }
        } catch {
          // Not JSON, treat as plain text
        }
        // For plain strings, check if trimmed length > 0
        // This handles "1", "2", "hello", etc.
        const trimmed = opt.trim();
        return trimmed.length > 0;
      }
      
      // Handle objects with text/image properties
      if (typeof opt === 'object' && opt !== null) {
        return (opt.text && String(opt.text).trim()) || (opt.image && String(opt.image).trim());
      }
      
      // Everything else is invalid
      return false;
    });
    
    if (validOptions.length < 2) {
      return res.status(400).json({ error: 'Options must contain at least 2 non-empty items' });
    }

    // Ensure we have exactly 4 options (pad with empty strings if needed)
    const finalOptions = [...parsedOptions];
    while (finalOptions.length < 4) {
      finalOptions.push('');
    }
    if (finalOptions.length > 4) {
      finalOptions.splice(4);
    }

    // Validate correctOption is in valid options (compare as strings so Excel number vs "0.25" match)
    const correctOptionStr = correctOption != null ? String(correctOption) : '';
    const isValidOption = validOptions.some((opt: any) => {
      const optStr = opt != null ? String(opt) : '';
      if (optStr === correctOptionStr) return true;
      if (typeof opt === 'string') {
        try {
          const parsed = JSON.parse(opt);
          return String(parsed?.text) === correctOptionStr || String(parsed?.image) === correctOptionStr;
        } catch {
          return false;
        }
      }
      return (opt?.text != null && String(opt.text) === correctOptionStr) || (opt?.image != null && String(opt.image) === correctOptionStr);
    });

    if (!correctOptionStr || !isValidOption) {
      return res.status(400).json({ error: 'correctOption must be one of the provided options' });
    }

    // Get next order if not provided
    let questionOrder = order;
    if (!questionOrder) {
      const lastQuestion = await prisma.question.findFirst({
        where: { contestId },
        orderBy: { order: 'desc' },
      });
      questionOrder = lastQuestion ? lastQuestion.order + 1 : 1;
    }

    const createdQuestion = await prisma.question.create({
      data: {
        contestId,
        question,
        type: type || 'NONE',
        media: media || null,
        options: JSON.stringify(finalOptions),
        correctOption: correctOptionStr,
        order: questionOrder,
      },
    });

    let responseOptions: string[] = [];
    try {
      responseOptions = JSON.parse(createdQuestion.options);
    } catch {}

    res.status(201).json({
      id: createdQuestion.id,
      contestId: createdQuestion.contestId,
      question: createdQuestion.question,
      type: createdQuestion.type,
      media: createdQuestion.media ? getImageUrl(createdQuestion.media) : null,
      options: responseOptions,
      correctOption: createdQuestion.correctOption,
      order: createdQuestion.order,
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// Update question (admin only)
router.put('/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: any = {};

    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (req.body.question) updateData.question = req.body.question;
    if (req.body.type) updateData.type = req.body.type;
    if (req.body.media !== undefined) updateData.media = req.body.media;
    if (req.body.options) {
      let optionsArray = Array.isArray(req.body.options) 
        ? req.body.options 
        : JSON.parse(req.body.options || '[]');
      
      // Parse options - they might be strings or objects with text/image
      // Ensure all options are properly formatted - convert numbers to strings if needed
      const parsedOptions = optionsArray.map((opt: any) => {
        // Handle null/undefined
        if (opt === null || opt === undefined) {
          return '';
        }
        
        // Handle numbers - convert to string to preserve them
        if (typeof opt === 'number') {
          return String(opt); // Convert number to string (e.g., 1 -> "1")
        }
        
        if (typeof opt === 'string') {
          // Try to parse if it's a JSON string
          try {
            const parsed = JSON.parse(opt);
            if (parsed && typeof parsed === 'object' && (parsed.text || parsed.image)) {
              return opt; // Keep as JSON string if it's an object
            }
          } catch {
            // Not JSON, treat as plain text - return as is
          }
          return opt;
        }
        
        // If it's already an object, stringify it
        if (typeof opt === 'object' && opt !== null && (opt.text || opt.image)) {
          return JSON.stringify(opt);
        }
        
        // Convert anything else to string
        return String(opt);
      });
      
      // Filter out empty options for validation
      const validOptions = parsedOptions.filter((opt: any) => {
        // Handle null or undefined
        if (opt === null || opt === undefined) {
          return false;
        }
        
        // Handle numbers (including 0)
        if (typeof opt === 'number') {
          return true; // All numbers are valid options, including 0
        }
        
        // Handle strings
        if (typeof opt === 'string') {
          // Try to parse as JSON first (for complex objects)
          try {
            const parsed = JSON.parse(opt);
            if (typeof parsed === 'object' && parsed !== null) {
              return (parsed.text && String(parsed.text).trim()) || (parsed.image && String(parsed.image).trim());
            }
          } catch {
            // Not JSON, treat as plain text
          }
          // For plain strings, check if trimmed length > 0
          // This handles "1", "2", "hello", etc.
          const trimmed = opt.trim();
          return trimmed.length > 0;
        }
        
        // Handle objects with text/image properties
        if (typeof opt === 'object' && opt !== null) {
          return (opt.text && String(opt.text).trim()) || (opt.image && String(opt.image).trim());
        }
        
        // Everything else is invalid
        return false;
      });
      
      if (validOptions.length < 2) {
        return res.status(400).json({ error: 'Options must contain at least 2 non-empty items' });
      }

      // Ensure we have exactly 4 options (pad with empty strings if needed)
      const finalOptions = [...parsedOptions];
      while (finalOptions.length < 4) {
        finalOptions.push('');
      }
      if (finalOptions.length > 4) {
        finalOptions.splice(4);
      }

      // Validate correctOption if provided
      if (req.body.correctOption) {
        const correctOptionStr = req.body.correctOption != null ? String(req.body.correctOption) : '';
        const isValidOption = validOptions.some((opt: any) => {
          const optStr = opt != null ? String(opt) : '';
          if (optStr === correctOptionStr) return true;
          if (typeof opt === 'string') {
            try {
              const parsed = JSON.parse(opt);
              return String(parsed?.text) === correctOptionStr || String(parsed?.image) === correctOptionStr;
            } catch {
              return false;
            }
          }
          return (opt?.text != null && String(opt.text) === correctOptionStr) || (opt?.image != null && String(opt.image) === correctOptionStr);
        });

        if (correctOptionStr && !isValidOption) {
          return res.status(400).json({ error: 'correctOption must be one of the provided options' });
        }
      }

      updateData.options = JSON.stringify(finalOptions);
    }
    if (req.body.correctOption !== undefined) updateData.correctOption = req.body.correctOption != null ? String(req.body.correctOption) : req.body.correctOption;
    if (req.body.order !== undefined) updateData.order = req.body.order;

    const updatedQuestion = await prisma.question.update({
      where: { id },
      data: updateData,
    });

    let responseOptions: string[] = [];
    try {
      responseOptions = JSON.parse(updatedQuestion.options);
    } catch {}

    res.json({
      id: updatedQuestion.id,
      contestId: updatedQuestion.contestId,
      question: updatedQuestion.question,
      type: updatedQuestion.type,
      media: updatedQuestion.media ? getImageUrl(updatedQuestion.media) : null,
      options: responseOptions,
      correctOption: updatedQuestion.correctOption,
      order: updatedQuestion.order,
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question (admin only)
router.delete('/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const question = await prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    await prisma.question.delete({
      where: { id },
    });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

export default router;

