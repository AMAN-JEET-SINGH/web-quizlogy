import express, { Request, Response } from 'express';
import { isAuthenticated, AuthRequest } from '../middleware/auth';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import prisma from '../config/database';
import { getApplicableQuestions } from './contests';

const router = express.Router();

// Helper function to get image URL based on environment
function getImageUrl(imagePath: string): string {
  console.log('🔍 Backend getImageUrl called with:', imagePath);
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.IMAGE_BASE_URL || 'http://localhost:5001';
  const digitalOceanUrl = process.env.DIGITAL_OCEAN_IMAGE_URL;

  // Default placeholder image
  if (!imagePath || imagePath === 'default' || imagePath === 'placeholder' || imagePath.trim() === '') {
    console.log('⚠️ No image path, returning placeholder:', `${baseUrl}/placeholder.jpg`);
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

// Get contest categories - matches /api/getContestCategories
router.get('/getContestCategories', async (req: Request, res: Response) => {
  console.log('📥 GET /api/getContestCategories - Request received');
  try {
    const { status, page = '1', limit = '100' } = req.query;
    console.log('Query params:', { status, page, limit });

    // Determine user's country code
    const queryCountry = req.query.country as string;
    const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
    const ipCountry = (req as any).clientCountryCode as string | undefined;
    const isAdminSession = !!(req.session as any)?.admin;
    let userCountry = 'ALL';
    if (queryCountry) {
      userCountry = queryCountry.toUpperCase();
    } else if (cfCountry) {
      userCountry = cfCountry.toUpperCase();
    } else if (ipCountry && ipCountry !== 'ALL' && ipCountry !== 'UN') {
      userCountry = ipCountry;
    }

    const where: any = {};
    if (status === 'ACTIVE' || status === 'INACTIVE') {
      where.status = status;
    } else {
      where.status = 'ACTIVE'; // Default to active
    }

    // Filter by user's country — skip for admin sessions
    if (!isAdminSession && userCountry !== 'ALL') {
      where.OR = [
        { countries: { contains: '"ALL"' } },
        { countries: { contains: `"${userCountry}"` } },
      ];
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    const categories = await prisma.category.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Filter categories: show if user's country matches the category's country list
    let filtered = categories;
    if (!isAdminSession && userCountry !== 'ALL') {
      filtered = categories.filter(cat => {
        let catCountries: string[] = ['ALL'];
        try { catCountries = JSON.parse(cat.countries); } catch {}
        // Show category if it's global OR if user's country is in the list
        return catCountries.includes('ALL') || catCountries.includes(userCountry);
      });
    }

    // Apply pagination manually on the filtered array
    const total = filtered.length;
    const paged = filtered.slice(skip, skip + limitNum);

    // Transform to match expected format
    const results = paged.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description || '',
      image: category.imagePath.split('/').pop() || category.imagePath, // Just filename
      status: category.status,
      countries: (() => { try { return JSON.parse(category.countries); } catch { return ['ALL']; } })(),
    }));

    console.log(`✅ Returning ${results.length} categories`);
    res.json({
      status: true,
      results,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      totalResults: total,
    });
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch categories',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all categories - /api/categories
router.get('/categories', async (req: Request, res: Response) => {
  console.log('📥 GET /api/categories - Request received');
  try {
    const { status } = req.query;

    // Determine user's country code
    const queryCountry = req.query.country as string;
    const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
    const ipCountry = (req as any).clientCountryCode as string | undefined;
    let userCountry = 'ALL';
    if (queryCountry) {
      // Explicit country param — respect it as-is (including 'ALL' to skip filtering)
      userCountry = queryCountry.toUpperCase();
    } else if (cfCountry) {
      userCountry = cfCountry.toUpperCase();
    } else if (ipCountry && ipCountry !== 'ALL' && ipCountry !== 'UN') {
      userCountry = ipCountry;
    }

    const where: any = {};
    if (status === 'ACTIVE' || status === 'INACTIVE') {
      where.status = status;
    }

    // Filter by user's country (skip if country unknown or explicitly ALL)
    if (userCountry !== 'ALL') {
      where.OR = [
        { countries: { contains: '"ALL"' } },
        { countries: { contains: `"${userCountry}"` } },
      ];
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Filter categories: show if user's country matches the category's country list
    let filtered = categories;
    if (userCountry !== 'ALL') {
      filtered = categories.filter(cat => {
        let catCountries: string[] = ['ALL'];
        try { catCountries = JSON.parse(cat.countries); } catch {}
        // Show category if it's global OR if user's country is in the list
        return catCountries.includes('ALL') || catCountries.includes(userCountry);
      });
    }

    // Transform image paths based on environment
    const transformedCategories = filtered.map((category) => {
      const imageUrl = getImageUrl(category.imagePath);
      return {
        ...category,
        imageUrl,
        countries: (() => { try { return JSON.parse(category.countries); } catch { return ['ALL']; } })(),
      };
    });

    res.json(transformedCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get category by ID - /api/categories/:id (specific path to avoid conflicts)
router.get('/categories/:id', async (req: Request, res: Response) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      ...category,
      imageUrl: getImageUrl(category.imagePath),
      countries: (() => { try { return JSON.parse(category.countries); } catch { return ['ALL']; } })(),
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Create category (admin only) - /api/categories
router.post('/categories', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    console.log('📥 POST /api/categories - Create category request:', {
      body: req.body,
      hasSession: !!req.session,
      isAdmin: !!(req.session as any)?.admin,
    });

    const { name, description, imagePath, backgroundColor, status, countries } = req.body;

    // Validation
    if (!name) {
      console.log(' Missing name field');
      return res.status(400).json({
        error: 'Missing required fields: name is required',
      });
    }

    // Use a default path for database (getImageUrl will return null for default/placeholder)
    const finalImagePath = imagePath || 'uploads/categories/default.jpg';

    // Validate backgroundColor - must be a valid hex color or null
    let validBackgroundColor = backgroundColor || null;
    if (validBackgroundColor && !/^#[0-9A-Fa-f]{6}$/.test(validBackgroundColor)) {
      validBackgroundColor = null; // Invalid color, set to null
    }

    // Validate status - convert to uppercase
    let validStatus = 'ACTIVE';
    if (status) {
      const statusUpper = status.toString().toUpperCase();
      validStatus = statusUpper === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    // Validate countries array
    const countriesJson = Array.isArray(countries) && countries.length > 0
      ? JSON.stringify(countries.map((c: string) => c.toUpperCase()))
      : '["ALL"]';

    console.log('🔍 Category data:', {
      name,
      description,
      imagePath: finalImagePath,
      backgroundColor: validBackgroundColor,
      status: validStatus,
      countries: countriesJson,
    });

    // Check if category name already exists
    const existingCategory = await prisma.category.findUnique({
      where: { name },
    });

    if (existingCategory) {
      console.log(' Category already exists:', name);
      return res.status(409).json({ error: 'Category with this name already exists' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        description: description || null,
        imagePath: finalImagePath,
        backgroundColor: validBackgroundColor,
        status: validStatus,
        countries: countriesJson,
      },
    });

    console.log(' Category created successfully:', category.id);
    res.status(201).json({
      ...category,
      imageUrl: getImageUrl(category.imagePath),
      countries: (() => { try { return JSON.parse(category.countries); } catch { return ['ALL']; } })(),
    });
  } catch (error) {
    console.error(' Error creating category:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      if (error.message.includes('Unique constraint')) {
        return res.status(409).json({ error: 'Category with this name already exists' });
      }
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category (admin only) - /api/categories/:id
router.put('/categories/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { name, description, imagePath, backgroundColor, status, countries } = req.body;
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Validate status if provided
    let validStatus = category.status;
    if (status !== undefined) {
      validStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    }

    // Validate backgroundColor - must be a valid hex color or null
    let validBackgroundColor = backgroundColor !== undefined ? (backgroundColor || null) : category.backgroundColor;
    if (validBackgroundColor && !/^#[0-9A-Fa-f]{6}$/.test(validBackgroundColor)) {
      validBackgroundColor = null; // Invalid color, set to null
    }

    // Validate countries array if provided
    let countriesJson: string | undefined;
    if (countries !== undefined) {
      countriesJson = Array.isArray(countries) && countries.length > 0
        ? JSON.stringify(countries.map((c: string) => c.toUpperCase()))
        : '["ALL"]';
    }

    // Check if name is being changed and if it conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await prisma.category.findUnique({
        where: { name },
      });

      if (existingCategory) {
        return res.status(409).json({ error: 'Category with this name already exists' });
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(imagePath && { imagePath }),
        ...(backgroundColor !== undefined && { backgroundColor: validBackgroundColor }),
        ...(status !== undefined && { status: validStatus }),
        ...(countriesJson !== undefined && { countries: countriesJson }),
      },
    });

    res.json({
      ...updatedCategory,
      imageUrl: getImageUrl(updatedCategory.imagePath),
      countries: (() => { try { return JSON.parse(updatedCategory.countries); } catch { return ['ALL']; } })(),
    });
  } catch (error) {
    console.error('Error updating category:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category (admin only) - /api/categories/:id
// Deletes the category and its contests. Questions are kept (contestId set to null).
router.delete('/categories/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: { contests: { select: { id: true } } },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const contestCount = category.contests.length;

    // Delete category — cascades to contests (which cascade-delete participations
    // and set-null on questions, preserving them).
    await prisma.category.delete({
      where: { id },
    });

    res.json({
      message: `Category deleted successfully. ${contestCount} contest(s) removed. Questions have been preserved.`,
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Toggle category status (admin only)
router.patch('/:id/toggle-status', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const newStatus = category.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { status: newStatus },
    });

    res.json({
      ...updatedCategory,
      imageUrl: getImageUrl(updatedCategory.imagePath),
      countries: (() => { try { return JSON.parse(updatedCategory.countries); } catch { return ['ALL']; } })(),
    });
  } catch (error) {
    console.error('Error toggling category status:', error);
    res.status(500).json({ error: 'Failed to toggle category status' });
  }
});

export default router;


