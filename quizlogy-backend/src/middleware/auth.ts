import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    googleId: string;
    picture?: string | null;
    givenName?: string;
    familyName?: string;
    coins?: number;
  };
}

export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if ((req as any).isAuthenticated && (req as any).isAuthenticated()) {
    // Attach user to request if available
    const user = (req as any).user;
    if (user) {
      (req as AuthRequest).user = {
        id: user.id,
        email: user.email,
        name: user.name,
        googleId: user.googleId,
        picture: user.picture,
        givenName: user.givenName,
        familyName: user.familyName,
        coins: (user as any).coins,
      };
    }
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};


