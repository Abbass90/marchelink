import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { ProductService } from '../products/product.service.js';
import { ProductRepository } from '../products/product.repository.js';
import { OrderService } from '../orders/order.service.js';
import { OrderRepository } from '../orders/order.repository.js';
import { OrderEventRepository } from '../orders/order-event.repository.js';
import { db } from '../../db/knex.js';

// Placeholder non-vide pour éviter que le SDK ne jette à l'instanciation
// quand ANTHROPIC_API_KEY est absente (CI/tests — les appels y sont mockés).
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? 'missing-anthropic-api-key',
});
const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest';

const productService = new ProductService(new ProductRepository(db));
const orderService = new OrderService(new OrderRepository(db), db, new OrderEventRepository(db));
const assistantService = new AssistantService(anthropic, productService, orderService, model);
const assistantController = new AssistantController(assistantService);

export const assistantRouter = Router();

// Réservé aux acheteurs (boutiquiers).
assistantRouter.post('/chat', requireAuth, requireRole('buyer'), assistantController.chat);
