import express, { Request, Response } from 'express';
import session from 'express-session';
import { isAdmin, AdminRequest } from '../middleware/adminAuth';
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

    const adminUsername = process.env.ADMIN_USERNAME?.trim().replace(/^["']|["']$/g, '');
    const adminPassword = process.env.ADMIN_PASSWORD?.trim().replace(/^["']|["']$/g, '');

    console.log('🔍 Environment check:', {
      hasAdminUsername: !!adminUsername,
      hasAdminPassword: !!adminPassword,
      adminUsernameLength: adminUsername?.length,
      adminPasswordLength: adminPassword?.length,
    });

    if (!adminUsername || !adminPassword) {
      console.error(' Admin credentials not configured');
      return res.status(500).json({ error: 'Admin credentials not configured' });
    }

    console.log('🔐 Login attempt:', { 
      providedUsername: username, 
      providedUsernameLength: username.length,
      expectedUsername: adminUsername,
      expectedUsernameLength: adminUsername.length,
      usernameMatch: username === adminUsername,
      providedPassword: password ? '***' : 'empty',
      providedPasswordLength: password?.length,
      expectedPassword: adminPassword ? '***' : 'empty',
      expectedPasswordLength: adminPassword?.length,
      passwordMatch: password === adminPassword,
      usernameCharCodes: username.split('').map((c: string) => c.charCodeAt(0)),
      expectedUsernameCharCodes: adminUsername.split('').map(c => c.charCodeAt(0)),
    });

    if (username === adminUsername && password === adminPassword) {
      // Set admin session
      (req.session as any).admin = { isAdmin: true };
      console.log(' Login successful, session set:', {
        sessionID: req.sessionID,
        hasAdmin: !!(req.session as any).admin,
      });
      res.json({ message: 'Admin login successful', isAdmin: true });
    } else {
      console.log(' Invalid credentials');
      res.status(401).json({ error: 'Invalid credentials' });
    }
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

// Check admin status
router.get('/status', isAdmin, (req: AdminRequest, res: Response) => {
  res.json({ isAdmin: true });
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

