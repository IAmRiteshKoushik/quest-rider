import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.utils';
import { throwError } from '../utils/errorFunction';
import type { TokenPayload } from '../types/auth.types';
import { env } from '../env';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      email?: string;
      role?: string;
      expiresAt?: string;
      issuer?: string;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return throwError(401, "Unauthorized", 'AUTH', "No access token found");
  }

  let payload: TokenPayload;
  try {
    payload = await verifyToken<TokenPayload>(token);
  } catch (_) {
    return throwError(401, 'Unauthorized', 'AUTH', 'Invalid or tampered token');
  }

  if (new Date(payload.expiresAt) < new Date()) {
    return throwError(401, 'Unauthorized', 'AUTH', 'Expired access token');
  }

  if (payload.issuer !== env.TOKEN_ISSUER) {
    return throwError(401, 'Unauthorized', 'AUTH', 'Invalid token issuer');
  }

  // Attach user info to request
  req.userId = payload.userId;
  req.email = payload.email;
  req.role = payload.role;

  next();
};

export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.role || req.role !== role) {
      return throwError(403, 'Forbidden', 'AUTH', `Required role was ${role}, but user role is ${req.role}`);
    }
    next();
  };
};