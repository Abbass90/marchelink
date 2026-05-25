import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatRepository } from './chat.repository.js';
import { db } from '../../db/knex.js';

const chatRepo = new ChatRepository(db);
const chatService = new ChatService(chatRepo, db);
const chatController = new ChatController(chatService);

export const chatRouter = Router();

// Discovery — liste les orgs grossistes (buyer uniquement)
chatRouter.get('/orgs', requireAuth, requireRole('buyer'), chatController.listOrgs);

// Conversations
chatRouter.post('/conversations', requireAuth, requireRole('buyer'), chatController.createConversation);
chatRouter.get('/conversations', requireAuth, requireRole('buyer', 'wholesaler_admin', 'wholesaler_seller'), chatController.listConversations);

// Messages dans une conversation
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
