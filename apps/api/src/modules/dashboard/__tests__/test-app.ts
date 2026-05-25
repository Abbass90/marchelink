import express from 'express';
import cookieParser from 'cookie-parser';
import { Router } from 'express';
import { correlationId } from '../../../middleware/correlation-id.middleware.js';
import { errorHandler } from '../../../middleware/error-handler.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { requireRole } from '../../../middleware/role.middleware.js';
import { AuthController } from '../../auth/auth.controller.js';
import { AuthService } from '../../auth/auth.service.js';
import { AuthRepository } from '../../auth/auth.repository.js';
import { DashboardController } from '../dashboard.controller.js';
import { DashboardService } from '../dashboard.service.js';
import { DashboardRepository } from '../dashboard.repository.js';
import { getTestDb } from '../../auth/__tests__/setup.js';

export function createDashboardTestApp() {
  const db = getTestDb();

  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo);
  const authController = new AuthController(authService);

  const dashboardRepo = new DashboardRepository(db);
  const dashboardService = new DashboardService(dashboardRepo);
  const dashboardController = new DashboardController(dashboardService);

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(correlationId());

  // Auth routes
  const authRouter = Router();
  authRouter.post('/login', authController.login);
  app.use('/api/auth', authRouter);

  // Dashboard route
  const dashRouter = Router();
  dashRouter.get('/', requireAuth, requireRole('wholesaler_admin'), dashboardController.getStats);
  app.use('/api/dashboard', dashRouter);

  app.use(errorHandler);
  return app;
}
