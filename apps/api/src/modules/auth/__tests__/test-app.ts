import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { correlationId } from '../../../middleware/correlation-id.middleware.js';
import { errorHandler } from '../../../middleware/error-handler.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { requireRole } from '../../../middleware/role.middleware.js';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { AuthRepository } from '../auth.repository.js';
import { getTestDb } from './setup.js';
import { Router } from 'express';

export function createTestApp(options?: { enableRateLimit?: boolean }) {
  const db = getTestDb();
  const repo = new AuthRepository(db);
  const service = new AuthService(repo, db);
  const controller = new AuthController(service);

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(correlationId());

  const authRouter = Router();
  authRouter.post('/register', controller.register);
  authRouter.post('/register-wholesaler', controller.registerWholesaler);
  authRouter.post('/login', controller.login);
  authRouter.post('/refresh', controller.refresh);
  authRouter.post('/logout', controller.logout);
  authRouter.get('/me', requireAuth, controller.me);
  authRouter.patch('/profile', requireAuth, controller.updateProfile);
  authRouter.patch('/password', requireAuth, controller.changePassword);

  if (options?.enableRateLimit) {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { status: 429, error: 'TOO_MANY_REQUESTS', message: 'Too many requests' },
    });
    app.use('/api/auth', limiter, authRouter);
  } else {
    app.use('/api/auth', authRouter);
  }

  // Protected route for testing auth middleware
  app.get('/api/protected', requireAuth, (_req, res) => {
    res.json({ user: _req.user });
  });

  // Role-guarded route for testing role middleware
  app.get('/api/admin-only', requireAuth, requireRole('platform_admin'), (_req, res) => {
    res.json({ ok: true });
  });

  app.use(errorHandler);
  return app;
}
