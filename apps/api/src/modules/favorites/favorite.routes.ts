import { Router } from 'express';
import { FavoriteController } from './favorite.controller.js';
import { FavoriteService } from './favorite.service.js';
import { FavoriteRepository } from './favorite.repository.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { db } from '../../db/knex.js';

const repo = new FavoriteRepository(db);
const service = new FavoriteService(repo, db);
const controller = new FavoriteController(service);

export const favoritesRouter = Router();

// All favorites endpoints require a logged-in buyer
favoritesRouter.use(requireAuth, requireRole('buyer'));

favoritesRouter.get('/', controller.list);
favoritesRouter.post('/:productId', controller.add);
favoritesRouter.delete('/:productId', controller.remove);
