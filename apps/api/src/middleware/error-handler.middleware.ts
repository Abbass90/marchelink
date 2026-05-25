import type { ErrorRequestHandler } from 'express';
import { logger } from '../config/logger.js';

// CLAUDE.md §21 : shape unique. §24 : log enrichi correlation_id + user_id + org_id.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next): void => {
  const status = (err as { status?: number }).status ?? 500;
  const errorCode = (err as { code?: string }).code ?? 'INTERNAL_ERROR';
  const message =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  logger.error({
    correlation_id: req.correlationId,
    user_id: (req as { user?: { id: string } }).user?.id,
    organization_id: (req as { user?: { organization_id?: string } }).user?.organization_id,
    error_name: err.name,
    error_message: err.message,
    error_stack: err.stack,
  });

  res.status(status).json({
    status,
    error: errorCode,
    message,
    requestId: req.correlationId,
  });
};
