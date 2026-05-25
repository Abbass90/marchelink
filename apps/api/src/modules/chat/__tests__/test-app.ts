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
import { ChatController } from '../chat.controller.js';
import { ChatService } from '../chat.service.js';
import { ChatRepository } from '../chat.repository.js';
import { getTestDb } from '../../auth/__tests__/setup.js';

export function createChatTestApp() {
  const db = getTestDb();

  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo);
  const authController = new AuthController(authService);

  const chatRepo = new ChatRepository(db);
  const chatService = new ChatService(chatRepo, db);
  const chatController = new ChatController(chatService);

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(correlationId());

  // Auth routes
  const authRouter = Router();
  authRouter.post('/register', authController.register);
  authRouter.post('/login', authController.login);
  app.use('/api/auth', authRouter);

  // Chat routes (spec §51–52)
  const chatRouter = Router();
  chatRouter.get('/orgs', requireAuth, requireRole('buyer'), chatController.listOrgs);
  chatRouter.post('/conversations', requireAuth, requireRole('buyer'), chatController.createConversation);
  chatRouter.get(
    '/conversations',
    requireAuth,
    requireRole('buyer', 'wholesaler_admin', 'wholesaler_seller'),
    chatController.listConversations,
  );
  chatRouter.get(
    '/conversations/:id/messages',
    requireAuth,
    requireRole('buyer', 'wholesaler_admin', 'wholesaler_seller'),
    chatController.getMessages,
  );
  chatRouter.post(
    '/conversations/:id/messages',
    requireAuth,
    requireRole('buyer', 'wholesaler_admin', 'wholesaler_seller'),
    chatController.sendMessage,
  );
  chatRouter.patch(
    '/conversations/:id/read',
    requireAuth,
    requireRole('buyer', 'wholesaler_admin', 'wholesaler_seller'),
    chatController.markRead,
  );
  app.use('/api/chat', chatRouter);

  app.use(errorHandler);
  return app;
}
