import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { db } from '../../db/knex.js';

const repo = new AuthRepository(db);
const service = new AuthService(repo, db);
const controller = new AuthController(service);

export const authRouter = Router();

authRouter.post('/register', controller.register);
authRouter.post('/register-wholesaler', controller.registerWholesaler);
authRouter.post('/login', controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/verify-email', controller.verifyEmail);
authRouter.get('/me', requireAuth, controller.me);
authRouter.patch('/profile', requireAuth, controller.updateProfile);
authRouter.patch('/password', requireAuth, controller.changePassword);
