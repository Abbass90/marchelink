import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { TokenPayload } from '../modules/auth/auth.service.js';

// Le type de `req.user` est déclaré globalement dans src/types/express.d.ts.

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token as string | undefined;

  if (!token) {
    res.status(401).json({
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Authentication required',
      requestId: req.correlationId,
    });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as TokenPayload;
    req.user = {
      id: payload.sub,
      role: payload.role,
      organization_id: payload.org,
    };
    next();
  } catch {
    res.status(401).json({
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
      requestId: req.correlationId,
    });
  }
}
