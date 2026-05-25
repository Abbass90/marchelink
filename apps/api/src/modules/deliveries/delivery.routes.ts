import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';
import { DeliveryRepository } from './delivery.repository.js';
import { OrderEventRepository } from '../orders/order-event.repository.js';
import { db } from '../../db/knex.js';

const deliveryRepo = new DeliveryRepository(db);
const eventRepo = new OrderEventRepository(db);
const deliveryService = new DeliveryService(deliveryRepo, eventRepo);
const deliveryController = new DeliveryController(deliveryService);

export const deliveriesRouter = Router();

// Wholesaler assigns delivery
deliveriesRouter.post('/', requireAuth, requireRole('wholesaler_admin'), deliveryController.assign);
deliveriesRouter.get('/org', requireAuth, requireRole('wholesaler_admin'), deliveryController.listByOrg);

// Delivery operator routes
deliveriesRouter.get('/available', requireAuth, requireRole('delivery_operator'), deliveryController.listAvailable);
deliveriesRouter.get('/mine', requireAuth, requireRole('delivery_operator'), deliveryController.listMine);
deliveriesRouter.post('/accept/:orderId', requireAuth, requireRole('delivery_operator'), deliveryController.acceptOrder);
deliveriesRouter.patch('/:id/delivered', requireAuth, requireRole('delivery_operator'), deliveryController.markDelivered);
