import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { isAdmin, isSuperAdmin, AdminRequest, SIDEBAR_SECTIONS } from '../middleware/adminAuth';
import prisma from '../config/database';

const router = express.Router();

// GET /api/admin-users - List all admin users (super admin only)
router.get('/', isAdmin, isSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        isSuperAdmin: true,
        allowedSections: true,
        adsenseAllowedDomains: true,
        adsenseAllowedCountries: true,
        adsenseRevenueShare: true,
        adsenseDomainDeductions: true,
        adsenseInHandRevenue: true,
        webAppLinks: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
    });

    // Parse JSON fields for response
    const parsedAdmins = admins.map(admin => ({
      ...admin,
      allowedSections: JSON.parse(admin.allowedSections || '[]'),
      adsenseAllowedDomains: JSON.parse(admin.adsenseAllowedDomains || '[]'),
      adsenseAllowedCountries: JSON.parse(admin.adsenseAllowedCountries || '[]'),
      adsenseDomainDeductions: JSON.parse(admin.adsenseDomainDeductions || '{}'),
      webAppLinks: JSON.parse(admin.webAppLinks || '[]'),
    }));

    res.json({
      status: true,
      data: parsedAdmins,
    });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// GET /api/admin-users/sections - Get available sidebar sections
router.get('/sections', isAdmin, isSuperAdmin, async (req: AdminRequest, res: Response) => {
  res.json({
    status: true,
    sections: SIDEBAR_SECTIONS,
  });
});

// GET /api/admin-users/:id - Get single admin user
router.get('/:id', isAdmin, isSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const admin = await prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        isSuperAdmin: true,
        allowedSections: true,
        adsenseAllowedDomains: true,
        adsenseAllowedCountries: true,
        adsenseRevenueShare: true,
        adsenseDomainDeductions: true,
        adsenseInHandRevenue: true,
        webAppLinks: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    res.json({
      status: true,
      data: {
        ...admin,
        allowedSections: JSON.parse(admin.allowedSections || '[]'),
        adsenseAllowedDomains: JSON.parse(admin.adsenseAllowedDomains || '[]'),
        adsenseAllowedCountries: JSON.parse(admin.adsenseAllowedCountries || '[]'),
        adsenseDomainDeductions: JSON.parse(admin.adsenseDomainDeductions || '{}'),
        webAppLinks: JSON.parse(admin.webAppLinks || '[]'),
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin user:', error);
    res.status(500).json({ error: 'Failed to fetch admin user' });
  }
});

// POST /api/admin-users - Create new admin user (super admin only)
router.post('/', isAdmin, isSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const {
      username,
      password,
      allowedSections = [],
      adsenseAllowedDomains = [],
      adsenseAllowedCountries = [],
      adsenseRevenueShare = 100,
      adsenseDomainDeductions = {},
      adsenseInHandRevenue = 0,
      webAppLinks = [],
      isActive = true,
    } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists
    const existing = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Validate allowed sections
    const validSections = allowedSections.filter((s: string) =>
      SIDEBAR_SECTIONS.includes(s as any)
    );

    // Validate revenue share
    const validRevenueShare = Math.max(0, Math.min(100, Number(adsenseRevenueShare) || 100));

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Validate in-hand revenue
    const validInHandRevenue = Math.max(0, Number(adsenseInHandRevenue) || 0);

    // Validate webAppLinks
    const validWebAppLinks = Array.isArray(webAppLinks) ? webAppLinks : [];

    // Validate domain deductions (each value must be 0-100)
    const validDomainDeductions: Record<string, number> = {};
    if (adsenseDomainDeductions && typeof adsenseDomainDeductions === 'object') {
      for (const [domain, pct] of Object.entries(adsenseDomainDeductions)) {
        const num = Number(pct);
        if (!isNaN(num)) {
          validDomainDeductions[domain] = Math.max(0, Math.min(100, num));
        }
      }
    }

    const admin = await prisma.adminUser.create({
      data: {
        username,
        passwordHash,
        isSuperAdmin: false, // Never create super admin via API
        allowedSections: JSON.stringify(validSections),
        adsenseAllowedDomains: JSON.stringify(adsenseAllowedDomains),
        adsenseAllowedCountries: JSON.stringify(adsenseAllowedCountries),
        adsenseRevenueShare: validRevenueShare,
        adsenseDomainDeductions: JSON.stringify(validDomainDeductions),
        adsenseInHandRevenue: validInHandRevenue,
        webAppLinks: JSON.stringify(validWebAppLinks),
        isActive,
        createdBy: req.adminData?.id,
      },
      select: {
        id: true,
        username: true,
        isSuperAdmin: true,
        allowedSections: true,
        adsenseAllowedDomains: true,
        adsenseAllowedCountries: true,
        adsenseRevenueShare: true,
        adsenseDomainDeductions: true,
        adsenseInHandRevenue: true,
        webAppLinks: true,
        isActive: true,
        createdAt: true,
        createdBy: true,
      },
    });

    console.log('✅ Admin user created:', admin.username);

    res.status(201).json({
      status: true,
      message: 'Admin user created successfully',
      data: {
        ...admin,
        allowedSections: JSON.parse(admin.allowedSections || '[]'),
        adsenseAllowedDomains: JSON.parse(admin.adsenseAllowedDomains || '[]'),
        adsenseAllowedCountries: JSON.parse(admin.adsenseAllowedCountries || '[]'),
        adsenseDomainDeductions: JSON.parse(admin.adsenseDomainDeductions || '{}'),
        webAppLinks: JSON.parse(admin.webAppLinks || '[]'),
      },
    });
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// PUT /api/admin-users/:id - Update admin user (super admin only)
router.put('/:id', isAdmin, isSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      username,
      password,
      allowedSections,
      adsenseAllowedDomains,
      adsenseAllowedCountries,
      adsenseRevenueShare,
      adsenseDomainDeductions,
      adsenseInHandRevenue,
      webAppLinks,
      isActive,
    } = req.body;

    // Find the admin user
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existingAdmin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Cannot modify super admin through API (except self)
    if (existingAdmin.isSuperAdmin && existingAdmin.id !== req.adminData?.id) {
      return res.status(403).json({ error: 'Cannot modify super admin' });
    }

    // Build update data
    const updateData: any = {};

    if (username !== undefined) {
      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }

      // Check if new username already exists (for different user)
      const usernameExists = await prisma.adminUser.findFirst({
        where: {
          username,
          NOT: { id },
        },
      });

      if (usernameExists) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      updateData.username = username;
    }

    if (password !== undefined && password !== '') {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (allowedSections !== undefined && !existingAdmin.isSuperAdmin) {
      const validSections = allowedSections.filter((s: string) =>
        SIDEBAR_SECTIONS.includes(s as any)
      );
      updateData.allowedSections = JSON.stringify(validSections);
    }

    if (adsenseAllowedDomains !== undefined) {
      updateData.adsenseAllowedDomains = JSON.stringify(adsenseAllowedDomains);
    }

    if (adsenseAllowedCountries !== undefined) {
      updateData.adsenseAllowedCountries = JSON.stringify(adsenseAllowedCountries);
    }

    if (adsenseRevenueShare !== undefined && !existingAdmin.isSuperAdmin) {
      updateData.adsenseRevenueShare = Math.max(0, Math.min(100, Number(adsenseRevenueShare) || 100));
    }

    if (isActive !== undefined && !existingAdmin.isSuperAdmin) {
      updateData.isActive = isActive;
    }

    if (adsenseInHandRevenue !== undefined && !existingAdmin.isSuperAdmin) {
      updateData.adsenseInHandRevenue = Math.max(0, Number(adsenseInHandRevenue) || 0);
    }

    if (webAppLinks !== undefined) {
      updateData.webAppLinks = JSON.stringify(Array.isArray(webAppLinks) ? webAppLinks : []);
    }

    if (adsenseDomainDeductions !== undefined && !existingAdmin.isSuperAdmin) {
      const validDomainDeductions: Record<string, number> = {};
      if (adsenseDomainDeductions && typeof adsenseDomainDeductions === 'object') {
        for (const [domain, pct] of Object.entries(adsenseDomainDeductions)) {
          const num = Number(pct);
          if (!isNaN(num)) {
            validDomainDeductions[domain] = Math.max(0, Math.min(100, num));
          }
        }
      }
      updateData.adsenseDomainDeductions = JSON.stringify(validDomainDeductions);
    }

    const admin = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        isSuperAdmin: true,
        allowedSections: true,
        adsenseAllowedDomains: true,
        adsenseAllowedCountries: true,
        adsenseRevenueShare: true,
        adsenseDomainDeductions: true,
        adsenseInHandRevenue: true,
        webAppLinks: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
    });

    console.log('✅ Admin user updated:', admin.username);

    res.json({
      status: true,
      message: 'Admin user updated successfully',
      data: {
        ...admin,
        allowedSections: JSON.parse(admin.allowedSections || '[]'),
        adsenseAllowedDomains: JSON.parse(admin.adsenseAllowedDomains || '[]'),
        adsenseAllowedCountries: JSON.parse(admin.adsenseAllowedCountries || '[]'),
        adsenseDomainDeductions: JSON.parse(admin.adsenseDomainDeductions || '{}'),
        webAppLinks: JSON.parse(admin.webAppLinks || '[]'),
      },
    });
  } catch (error: any) {
    console.error('Error updating admin user:', error);
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

// DELETE /api/admin-users/:id - Delete admin user (super admin only)
router.delete('/:id', isAdmin, isSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Find the admin user
    const admin = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Cannot delete super admin
    if (admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Cannot delete super admin' });
    }

    // Cannot delete self
    if (admin.id === req.adminData?.id) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    await prisma.adminUser.delete({
      where: { id },
    });

    console.log('✅ Admin user deleted:', admin.username);

    res.json({
      status: true,
      message: 'Admin user deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting admin user:', error);
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

// PATCH /api/admin-users/:id/toggle-active - Toggle admin active status
router.patch('/:id/toggle-active', isAdmin, isSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const admin = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Cannot toggle super admin
    if (admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Cannot modify super admin status' });
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: { isActive: !admin.isActive },
      select: {
        id: true,
        username: true,
        isActive: true,
      },
    });

    console.log(`✅ Admin user ${updated.username} is now ${updated.isActive ? 'active' : 'inactive'}`);

    res.json({
      status: true,
      message: `Admin user is now ${updated.isActive ? 'active' : 'inactive'}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error toggling admin status:', error);
    res.status(500).json({ error: 'Failed to toggle admin status' });
  }
});

export default router;
