import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import { correlationId } from '../../../middleware/correlation-id.middleware.js';
import { errorHandler } from '../../../middleware/error-handler.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { requireRole } from '../../../middleware/role.middleware.js';
import { AuthController } from '../../auth/auth.controller.js';
import { AuthService } from '../../auth/auth.service.js';
import { AuthRepository } from '../../auth/auth.repository.js';
import { FavoriteController } from '../favorite.controller.js';
import { FavoriteService } from '../favorite.service.js';
import { FavoriteRepository } from '../favorite.repository.js';
import { getTestDb } from '../../auth/__tests__/setup.js';

export function createFavoritesTestApp() {
  const db = getTestDb();

  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo);
  const authController = new AuthController(authService);

  const repo = new FavoriteRepository(db);
  const service = new FavoriteService(repo, db);
  const controller = new FavoriteController(service);

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(correlationId());

  const authRouter = Router();
  authRouter.post('/register', authController.register);
  authRouter.post('/login', authController.login);
  app.use('/api/auth', authRouter);

  const favRouter = Router();
  favRouter.use(requireAuth, requireRole('buyer'));
  favRouter.get('/', controller.list);
  favRouter.post('/:productId', controller.add);
  favRouter.delete('/:productId', controller.remove);
  app.use('/api/favorites', favRouter);

  app.use(errorHandler);
  return app;
}
