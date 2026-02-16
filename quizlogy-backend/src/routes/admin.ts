import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { isAdmin, AdminRequest, AdminData, SIDEBAR_SECTIONS } from '../middleware/adminAuth';
import prisma from '../config/database';

const router = express.Router();

// Admin login
router.post('/login', async (req: Request, res: Response) => {
  try {
    console.log('📥 Admin login request received:', {
      body: req.body,
      hasSession: !!req.session,
      sessionID: req.sessionID,
    });

    const { username, password } = req.body;

    if (!username || !password) {
      console.log(' Missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // First, try to find admin in database (may fail if table doesn't exist yet)
    let dbAdmin = null;
    try {
      dbAdmin = await prisma.adminUser.findUnique({
        where: { username },
      });
    } catch (dbError: any) {
      // Table might not exist yet, fall through to env vars check
      console.log('⚠️ AdminUser table query failed (migration may be pending):', dbError.message);
    }

    if (dbAdmin) {
      // Check if admin is active
      if (!dbAdmin.isActive) {
        console.log(' Admin account is inactive');
        return res.status(401).json({ error: 'Account is inactive' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, dbAdmin.passwordHash);
      if (!isValidPassword) {
        console.log(' Invalid password for database admin');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      await prisma.adminUser.update({
        where: { id: dbAdmin.id },
        data: { lastLogin: new Date() },
      });

      // Parse JSON fields
      const allowedSections = JSON.parse(dbAdmin.allowedSections || '[]');
      const adsenseAllowedDomains = JSON.parse(dbAdmin.adsenseAllowedDomains || '[]');
      const adsenseAllowedCountries = JSON.parse(dbAdmin.adsenseAllowedCountries || '[]');
      let adsenseDomainDeductions: Record<string, number> = {};
      try { adsenseDomainDeductions = JSON.parse((dbAdmin as any).adsenseDomainDeductions || '{}'); } catch {}

      const webAppLinks = JSON.parse(dbAdmin.webAppLinks || '[]');

      const adminData: AdminData = {
        id: dbAdmin.id,
        username: dbAdmin.username,
        isSuperAdmin: dbAdmin.isSuperAdmin,
        allowedSections: dbAdmin.isSuperAdmin ? [...SIDEBAR_SECTIONS] : allowedSections,
        adsenseAllowedDomains,
        adsenseAllowedCountries,
        adsenseRevenueShare: dbAdmin.adsenseRevenueShare,
        adsenseDomainDeductions,
        adsenseInHandRevenue: dbAdmin.adsenseInHandRevenue,
        webAppLinks,
        createdAt: dbAdmin.createdAt.toISOString(),
      };

      // Set session
      (req.session as any).admin = { isAdmin: true };
      (req.session as any).adminData = adminData;

      console.log('✅ Database admin login successful:', {
        username: dbAdmin.username,
        isSuperAdmin: dbAdmin.isSuperAdmin,
      });

      // Strip deduction info from non-super-admin response
      const responseData = dbAdmin.isSuperAdmin
        ? adminData
        : { ...adminData, adsenseDomainDeductions: undefined };

      return res.json({
        message: 'Admin login successful',
        isAdmin: true,
        adminData: responseData,
      });
    }

    // Fallback: Check env vars for super admin
    const adminUsername = process.env.ADMIN_USERNAME?.trim().replace(/^["']|["']$/g, '');
    const adminPassword = process.env.ADMIN_PASSWORD?.trim().replace(/^["']|["']$/g, '');
    const superAdminId = process.env.SUPER_ADMIN_ID?.trim().replace(/^["']|["']$/g, '');

    console.log('🔍 Environment check:', {
      hasAdminUsername: !!adminUsername,
      hasAdminPassword: !!adminPassword,
      hasSuperAdminId: !!superAdminId,
    });

    if (!adminUsername || !adminPassword) {
      console.error(' Admin credentials not configured');
      return res.status(500).json({ error: 'Admin credentials not configured' });
    }

    if (username === adminUsername && password === adminPassword) {
      // This is the super admin from env vars
      let superAdminId = 'super-admin';

      // Try to create or update the super admin record in database
      // This may fail if migration hasn't been run yet
      try {
        const passwordHash = await bcrypt.hash(password, 10);
        const superAdmin = await prisma.adminUser.upsert({
          where: { username: adminUsername },
          update: {
            lastLogin: new Date(),
            isSuperAdmin: true,
            isActive: true,
          },
          create: {
            username: adminUsername,
            passwordHash,
            isSuperAdmin: true,
            allowedSections: JSON.stringify([...SIDEBAR_SECTIONS]),
            adsenseAllowedDomains: '[]',
            adsenseAllowedCountries: '[]',
            adsenseRevenueShare: 100,
            isActive: true,
            lastLogin: new Date(),
          },
        });
        superAdminId = superAdmin.id;
      } catch (dbError: any) {
        console.log('⚠️ Could not save super admin to database (migration may be pending):', dbError.message);
      }

      const adminData: AdminData = {
        id: superAdminId,
        username: adminUsername,
        isSuperAdmin: true,
        allowedSections: [...SIDEBAR_SECTIONS],
        adsenseAllowedDomains: [],
        adsenseAllowedCountries: [],
        adsenseRevenueShare: 100,
        adsenseDomainDeductions: {},
        adsenseInHandRevenue: 0,
        webAppLinks: [],
        createdAt: new Date().toISOString(),
      };

      // Set session
      (req.session as any).admin = { isAdmin: true };
      (req.session as any).adminData = adminData;

      console.log('✅ Super admin login successful (from env vars)');

      return res.json({
        message: 'Admin login successful',
        isAdmin: true,
        adminData,
      });
    }

    console.log(' Invalid credentials');
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error(' Admin login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Admin logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Admin logged out successfully' });
  });
});

// Change own password (self-service)
router.post('/change-password', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const adminData = (req.session as any).adminData;
    if (!adminData?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Find the admin user in the database
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminData.id },
    });

    if (!adminUser) {
      // Might be env-var super admin — try matching by username
      const envUsername = process.env.ADMIN_USERNAME?.trim().replace(/^["']|["']$/g, '');
      const envPassword = process.env.ADMIN_PASSWORD?.trim().replace(/^["']|["']$/g, '');

      if (adminData.username === envUsername && currentPassword === envPassword) {
        // For env-var super admin, update the DB record if it exists
        const dbRecord = await prisma.adminUser.findUnique({ where: { username: envUsername } });
        if (dbRecord) {
          const newHash = await bcrypt.hash(newPassword, 10);
          await prisma.adminUser.update({
            where: { id: dbRecord.id },
            data: { passwordHash: newHash },
          });
          return res.json({ status: true, message: 'Password updated successfully' });
        }
        return res.status(400).json({ error: 'Cannot change password for environment-configured admin' });
      }

      return res.status(400).json({ error: 'Invalid current password' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, adminUser.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid current password' });
    }

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { passwordHash: newHash },
    });

    return res.json({ status: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Check admin status
router.get('/status', isAdmin, (req: AdminRequest, res: Response) => {
  const adminData = (req.session as any).adminData as AdminData | undefined;
  // Strip deduction info from non-super-admin response
  const responseData = adminData && !adminData.isSuperAdmin
    ? { ...adminData, adsenseDomainDeductions: undefined }
    : adminData;
  res.json({
    isAdmin: true,
    adminData: responseData || null,
  });
});

// Get all contact messages
router.get('/contact-messages', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      status: true,
      data: messages,
    });
  } catch (error: any) {
    console.error('Error fetching contact messages:', error);
    res.status(500).json({ error: 'Failed to fetch contact messages' });
  }
});

// Mark contact message as read
router.put('/contact-messages/:id/read', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const message = await prisma.contactMessage.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      status: true,
      data: message,
    });
  } catch (error: any) {
    console.error('Error updating contact message:', error);
    res.status(500).json({ error: 'Failed to update contact message' });
  }
});

// Delete a single contact message
router.delete('/contact-messages/:id', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.contactMessage.delete({
      where: { id },
    });

    res.json({
      status: true,
      message: 'Contact message deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting contact message:', error);
    res.status(500).json({ error: 'Failed to delete contact message' });
  }
});

// Delete all contact messages
router.delete('/contact-messages', isAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const result = await prisma.contactMessage.deleteMany({});

    res.json({
      status: true,
      message: `Deleted ${result.count} contact message(s) successfully`,
      count: result.count,
    });
  } catch (error: any) {
    console.error('Error deleting all contact messages:', error);
    res.status(500).json({ error: 'Failed to delete contact messages' });
  }
});

export default router;
