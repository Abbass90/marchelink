import { jest } from '@jest/globals';
import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import type Anthropic from '@anthropic-ai/sdk';
import { correlationId } from '../../../middleware/correlation-id.middleware.js';
import { errorHandler } from '../../../middleware/error-handler.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { requireRole } from '../../../middleware/role.middleware.js';
import { AuthController } from '../../auth/auth.controller.js';
import { AuthService } from '../../auth/auth.service.js';
import { AuthRepository } from '../../auth/auth.repository.js';
import { AssistantController } from '../assistant.controller.js';
import { AssistantService } from '../assistant.service.js';
import { ProductService } from '../../products/product.service.js';
import { ProductRepository } from '../../products/product.repository.js';
import { OrderService } from '../../orders/order.service.js';
import { OrderRepository } from '../../orders/order.repository.js';
import { OrderEventRepository } from '../../orders/order-event.repository.js';
import { getTestDb } from '../../auth/__tests__/setup.js';

/**
 * Mock partagé du client Anthropic. Les tests configurent ses réponses via
 * assistantMockCreate.mockResolvedValueOnce(...). Aucun appel réseau réel.
 */
export const assistantMockCreate = jest.fn();

export function createAssistantTestApp() {
  const db = getTestDb();

  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo);
  const authController = new AuthController(authService);

  const productService = new ProductService(new ProductRepository(db));
  const orderService = new OrderService(new OrderRepository(db), db, new OrderEventRepository(db));

  const fakeAnthropic = {
    messages: { create: assistantMockCreate },
  } as unknown as Anthropic;

  const assistantService = new AssistantService(fakeAnthropic, productService, orderService, 'test-model');
  const assistantController = new AssistantController(assistantService);

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(correlationId());

  const authRouter = Router();
  authRouter.post('/login', authController.login);
  app.use('/api/auth', authRouter);

  const assistantRouter = Router();
  assistantRouter.post('/chat', requireAuth, requireRole('buyer'), assistantController.chat);
  app.use('/api/assistant', assistantRouter);

  app.use(errorHandler);
  return app;
}
