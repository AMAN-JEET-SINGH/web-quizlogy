import { Request, Response, NextFunction } from 'express';

export interface AdminRequest extends Request {
  admin?: {
    isAdmin: boolean;
  };
}

export const isAdmin = (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  // Check if admin session exists
  if (req.session && (req.session as any).admin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized: Admin access required' });
};

