import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { PaymentRepository } from './payment.repository.js';
import { OrderEventRepository } from '../orders/order-event.repository.js';
import { db } from '../../db/knex.js';
import { webhookRateLimiter } from '../../middleware/rate-limit.middleware.js';

const paymentRepo = new PaymentRepository(db);
const eventRepo = new OrderEventRepository(db);
const paymentService = new PaymentService(paymentRepo, eventRepo);
const paymentController = new PaymentController(paymentService);

export const paymentsRouter = Router();

paymentsRouter.get('/my', requireAuth, requireRole('buyer'), paymentController.listByBuyer);
paymentsRouter.get('/org', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), paymentController.listByOrg);
paymentsRouter.post('/initiate', requireAuth, requireRole('buyer'), paymentController.initiate);
paymentsRouter.post('/webhook', webhookRateLimiter, paymentController.webhook);
