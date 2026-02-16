import express, { Request, Response } from 'express';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
import prisma from '../config/database';
import { autoSeedCountries } from '../utils/seedCountries';

const router = express.Router();

// POST /api/countries/seed — re-seed all default countries (admin)
router.post('/seed', isAdmin, async (_req: Request, res: Response) => {
  try {
    await autoSeedCountries();
    const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });
    res.json({ status: true, message: `Countries seeded. Total: ${countries.length}`, data: countries });
  } catch (error) {
    console.error('Error seeding countries:', error);
    res.status(500).json({ error: 'Failed to seed countries' });
  }
});

// GET /api/countries — list active countries (public)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ status: true, data: countries });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// GET /api/countries/all — list all countries (admin)
router.get('/all', isAdmin, async (_req: Request, res: Response) => {
  try {
    const countries = await prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ status: true, data: countries });
  } catch (error) {
    console.error('Error fetching all countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// POST /api/countries — create country (admin)
router.post('/', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { code, name, flagUrl, isActive } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'code and name are required' });
    }

    const upperCode = code.toUpperCase().trim();
    if (!/^[A-Z]{2}$/.test(upperCode)) {
      return res.status(400).json({ error: 'code must be a 2-letter ISO country code' });
    }

    const existing = await prisma.country.findUnique({ where: { code: upperCode } });
    if (existing) {
      return res.status(409).json({ error: 'Country with this code already exists' });
    }

    const country = await prisma.country.create({
      data: {
        code: upperCode,
        name: name.trim(),
        flagUrl: flagUrl || null,
        isActive: isActive !== false,
      },
    });

    res.status(201).json({ status: true, data: country });
  } catch (error) {
    console.error('Error creating country:', error);
    res.status(500).json({ error: 'Failed to create country' });
  }
});

// PUT /api/countries/:code — update country (admin)
router.put('/:code', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { code } = req.params;
    const { name, flagUrl, isActive } = req.body;

    const existing = await prisma.country.findUnique({ where: { code: code.toUpperCase() } });
    if (!existing) {
      return res.status(404).json({ error: 'Country not found' });
    }

    const country = await prisma.country.update({
      where: { code: code.toUpperCase() },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(flagUrl !== undefined && { flagUrl: flagUrl || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ status: true, data: country });
  } catch (error) {
    console.error('Error updating country:', error);
    res.status(500).json({ error: 'Failed to update country' });
  }
});

// DELETE /api/countries/:code — delete country (admin)
router.delete('/:code', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { code } = req.params;

    const existing = await prisma.country.findUnique({ where: { code: code.toUpperCase() } });
    if (!existing) {
      return res.status(404).json({ error: 'Country not found' });
    }

    await prisma.country.delete({ where: { code: code.toUpperCase() } });

    res.json({ status: true, message: 'Country deleted successfully' });
  } catch (error) {
    console.error('Error deleting country:', error);
    res.status(500).json({ error: 'Failed to delete country' });
  }
});

export default router;
