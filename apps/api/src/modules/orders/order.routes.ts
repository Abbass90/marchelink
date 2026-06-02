import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { OrderRepository } from './order.repository.js';
import { OrderEventRepository } from './order-event.repository.js';
import { db } from '../../db/knex.js';

const orderRepo = new OrderRepository(db);
const eventRepo = new OrderEventRepository(db);
const orderService = new OrderService(orderRepo, db, eventRepo);
const orderController = new OrderController(orderService);

export const ordersRouter = Router();

// Buyer routes
ordersRouter.post('/', requireAuth, requireRole('buyer'), orderController.placeOrder);
ordersRouter.get('/my', requireAuth, requireRole('buyer'), orderController.listByBuyer);
ordersRouter.get('/my/:id', requireAuth, requireRole('buyer'), orderController.getByIdForBuyer);
ordersRouter.get('/my/:id/detail', requireAuth, requireRole('buyer'), orderController.getOrderDetailForBuyer);
ordersRouter.get('/my/:id/timeline', requireAuth, requireRole('buyer'), orderController.getTimelineForBuyer);
ordersRouter.patch('/my/:id/cancel', requireAuth, requireRole('buyer'), orderController.cancelOrder);

// Wholesaler routes
ordersRouter.get('/org', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.listByOrg);
ordersRouter.get('/org/:id', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.getByIdForWholesaler);
ordersRouter.get('/org/:id/timeline', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.getTimelineForWholesaler);
ordersRouter.patch('/org/:id/status', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.updateStatus);
ordersRouter.patch('/org/:id/delivery-mode', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.setDeliveryMode);
