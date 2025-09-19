import type { Database } from '../types/supabase';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        isAdmin: boolean
      }
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';

/**
 * Verify JWT token from Authorization header
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Verify the JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Get user from Supabase
    const { data: profile, error } = await supabase
      // DISABLED: Table 'profiles' doesn't exist

      .from('profiles')
      .select('id, email, is_admin')
      .eq('id', decoded.sub)
      .single() as any || { data: [], error: null };
    
    if (error || !profile) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    
    // Attach user to request
    req.user = {
      id: profile.id,
      email: profile.email,
      isAdmin: profile.is_admin
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Require admin privileges
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  // First verify the token
  await verifyToken(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

/**
 * Optional authentication - adds user to request if authenticated
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }
  
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const { data: profile } = await supabase
      // DISABLED: Table 'profiles' doesn't exist

      .from('profiles')
      .select('id, email, is_admin')
      .eq('id', decoded.sub)
      .single() as any || { data: [], error: null };
    
    if (profile) {
      req.user = {
        id: profile.id,
        email: profile.email,
        isAdmin: profile.is_admin
      };
    }
  } catch {
    // Ignore errors for optional auth
  }
  
  next();
};

/**
 * Generate JWT token for a user
 */
export const generateToken = (userId: string, email: string): string => {
  return jwt.sign(
    {
      sub: userId,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
    },
    JWT_SECRET
  );
};