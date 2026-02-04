import express, { Request, Response } from 'express';
import passport from 'passport';
import { isAuthenticated, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

const router = express.Router();

// Initiate Google OAuth
router.get(
  '/google',
  (req: Request, res: Response, next: any) => {
    const session = req.session as any;
    
    // Store returnUrl from query params in session for use after OAuth callback
    if (req.query.state) {
      session.returnUrl = req.query.state;
    }
    
    // Get origin from query parameter (more reliable than headers)
    const originParam = req.query.origin as string;
    
    if (originParam === 'admin') {
      // Login initiated from admin panel
      session.loginOrigin = 'admin';
      session.adminUrl = process.env.ADMIN_FRONTEND_URL || 'http://localhost:3001';
    } else {
      // Login initiated from frontend (default)
      session.loginOrigin = 'frontend';
      session.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      // Also check referer/origin headers as fallback
      const referer = req.get('referer') || '';
      const origin = req.get('origin') || '';
      if (referer.includes('3001') || origin.includes('3001') || referer.includes('admin') || origin.includes('admin')) {
        session.loginOrigin = 'admin';
        session.adminUrl = process.env.ADMIN_FRONTEND_URL || 'http://localhost:3001';
      }
    }
    
    next();
  },
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: process.env.FRONTEND_URL || 'http://localhost:3000/login',
    session: true,
  }),
  async (req: Request, res: Response) => {
    try {
      // Successful authentication - track login in coin history
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      
      if (userId) {
        // Record login event in coin history (0 coins, just for tracking)
        try {
          await prisma.coinHistory.create({
            data: {
              userId,
              amount: 0,
              type: 'LOGIN',
              description: 'User logged in',
            },
          });
        } catch (historyError) {
          // Log but don't fail login if history creation fails
          console.error('Error recording login in coin history:', historyError);
        }
      }
      
      // Successful authentication - redirect based on where login was initiated
      const session = req.session as any;
      const loginOrigin = session?.loginOrigin || 'frontend';
      
      // Determine redirect URL based on origin
      let redirectUrl: string;
      
      if (loginOrigin === 'admin') {
        // Redirect to admin panel
        const adminUrl = session?.adminUrl || process.env.ADMIN_FRONTEND_URL || 'http://localhost:3001';
        redirectUrl = `${adminUrl}/dashboard`; // Admin dashboard after login
        console.log(`✅ Redirecting to admin panel: ${redirectUrl}`);
      } else {
        // Redirect to frontend
        let frontendUrl = session?.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
        
        // Safety check: if FRONTEND_URL points to admin panel, use default frontend URL
        if (frontendUrl.includes('3001') || frontendUrl.includes('admin')) {
          console.warn('⚠️  FRONTEND_URL appears to point to admin panel. Using default frontend URL.');
          frontendUrl = 'http://localhost:3000';
        }
        
        // Check for returnUrl in session (stored before OAuth redirect)
        const returnUrl = session?.returnUrl;
        if (returnUrl) {
          // Clear returnUrl from session
          delete session.returnUrl;
          // Validate returnUrl is from frontend domain
          const frontendDomain = new URL(frontendUrl).origin;
          try {
            const returnUrlObj = new URL(returnUrl, frontendUrl);
            if (returnUrlObj.origin === frontendDomain) {
              console.log(`✅ Redirecting to returnUrl: ${returnUrl}`);
              // Clear session data
              delete session.loginOrigin;
              delete session.frontendUrl;
              delete session.adminUrl;
              res.redirect(returnUrl);
              return;
            }
          } catch (e) {
            // Invalid URL, fall through to default redirect
            console.warn('⚠️  Invalid returnUrl, using default redirect');
          }
        }
        
        redirectUrl = `${frontendUrl}/login/success`;
        console.log(`✅ Redirecting to frontend: ${redirectUrl}`);
      }
      
      // Clear session data
      delete session.loginOrigin;
      delete session.frontendUrl;
      delete session.adminUrl;
      delete session.returnUrl;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error in OAuth callback:', error);
      // Still redirect even if history logging fails
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/login/success`);
    }
  }
);

// Get current user
router.get('/me', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch fresh user data from database to include picture, coins, and profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        googleId: true,
        coins: true,
        profile: {
          select: {
            mobileNo: true,
            whatsappNo: true,
            address: true,
            city: true,
            country: true,
            postalCode: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update current user profile
router.put('/me', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, picture, mobileNo, whatsappNo, address, city, country, postalCode } = req.body;
    
    // Update user basic info
    const userUpdateData: any = {};
    if (name !== undefined) {
      userUpdateData.name = name;
    }
    if (picture !== undefined) {
      userUpdateData.picture = picture;
    }

    // Update or create user profile
    const profileUpdateData: any = {};
    if (mobileNo !== undefined) profileUpdateData.mobileNo = mobileNo || null;
    if (whatsappNo !== undefined) profileUpdateData.whatsappNo = whatsappNo || null;
    if (address !== undefined) profileUpdateData.address = address || null;
    if (city !== undefined) profileUpdateData.city = city || null;
    if (country !== undefined) profileUpdateData.country = country || null;
    if (postalCode !== undefined) profileUpdateData.postalCode = postalCode || null;

    // Use transaction to update both user and profile
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update user
      const user = await tx.user.update({
      where: { id: userId },
        data: userUpdateData,
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        googleId: true,
        coins: true,
      },
      });

      // Upsert profile (create if doesn't exist, update if exists)
      await tx.userProfile.upsert({
        where: { userId },
        update: profileUpdateData,
        create: {
          userId,
          ...profileUpdateData,
        },
      });

      // Fetch updated user with profile
      return await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          googleId: true,
          coins: true,
          profile: {
            select: {
              mobileNo: true,
              whatsappNo: true,
              address: true,
              city: true,
              country: true,
              postalCode: true,
            },
          },
        },
      });
    });

    res.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete current user account
router.delete('/me', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete related records explicitly first (belt-and-suspenders with DB cascade)
    // Order matters: dependents first, then user
    await prisma.$transaction(async (tx) => {
      await tx.coinHistory.deleteMany({ where: { userId } });
      await tx.wheelSpin.deleteMany({ where: { userId } });
      await tx.questionReport.deleteMany({ where: { userId } });
      await tx.contestParticipation.deleteMany({ where: { userId } });
      await tx.userProfile.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    // Destroy session
    req.logout((err) => {
      if (err) {
        console.error('Error logging out after account deletion:', err);
      }
    });
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session after account deletion:', err);
      }
    });
    res.clearCookie('connect.sid');

    res.json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user account:', error);
    const message =
      error?.meta?.cause ||
      error?.message ||
      (error?.code ? `Database error: ${error.code}` : 'Failed to delete account');
    res.status(500).json({ error: message });
  }
});

// Award coins to current user
router.post('/me/award-coins', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, description, contestId } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid coin amount' });
    }

    // Award coins and create coin history in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Add coins to user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: {
            increment: amount,
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
          amount: amount,
          type: 'EARNED',
          description: description || `Earned ${amount} coins`,
          contestId: contestId || null,
        },
      });

      return updatedUser;
    });

    res.json({
      status: true,
      message: 'Coins awarded successfully',
      coins: result.coins,
    });
  } catch (error: any) {
    console.error('Error awarding coins:', error);
    res.status(500).json({ error: 'Failed to award coins' });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to destroy session' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

export default router;

