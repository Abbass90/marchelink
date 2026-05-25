import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
  }
}

// CLAUDE.md §22 : chaque requête entrante reçoit un correlation_id (UUID v4)
// injecté dans le header de réponse et propagé tout au long du cycle.
export function correlationId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header('x-correlation-id');
    const id = incoming && /^[a-f0-9-]{36}$/.test(incoming) ? incoming : uuidv4();
    req.correlationId = id;
    res.setHeader('x-correlation-id', id);
    next();
  };
}
