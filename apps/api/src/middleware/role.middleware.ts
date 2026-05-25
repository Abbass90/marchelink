import type { Request, Response, NextFunction } from 'express';

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 401,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.correlationId,
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      // §14: 404 pour masquer l'existence de la ressource
      res.status(404).json({
        status: 404,
        error: 'NOT_FOUND',
        message: 'Not found',
        requestId: req.correlationId,
      });
      return;
    }

    next();
  };
}
