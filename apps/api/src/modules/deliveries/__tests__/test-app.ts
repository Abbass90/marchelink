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
import { ProductController } from '../../products/product.controller.js';
import { ProductService } from '../../products/product.service.js';
import { ProductRepository } from '../../products/product.repository.js';
import { OrderController } from '../../orders/order.controller.js';
import { OrderService } from '../../orders/order.service.js';
import { OrderRepository } from '../../orders/order.repository.js';
import { DeliveryController } from '../delivery.controller.js';
import { DeliveryService } from '../delivery.service.js';
import { DeliveryRepository } from '../delivery.repository.js';
import { getTestDb } from '../../auth/__tests__/setup.js';

export function createDeliveryTestApp() {
  const db = getTestDb();

  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo);
  const authController = new AuthController(authService);

  const productRepo = new ProductRepository(db);
  const productService = new ProductService(productRepo);
  const productController = new ProductController(productService);

  const orderRepo = new OrderRepository(db);
  const orderService = new OrderService(orderRepo, db);
  const orderController = new OrderController(orderService);

  const deliveryRepo = new DeliveryRepository(db);
  const deliveryService = new DeliveryService(deliveryRepo);
  const deliveryController = new DeliveryController(deliveryService);

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(correlationId());

  // Auth routes
  const authRouter = Router();
  authRouter.post('/register', authController.register);
  authRouter.post('/login', authController.login);
  app.use('/api/auth', authRouter);

  // Product routes
  const prodRouter = Router();
  prodRouter.post('/', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), productController.create);
  app.use('/api/products', prodRouter);

  // Order routes
  const orderRouter = Router();
  orderRouter.post('/', requireAuth, requireRole('buyer'), orderController.placeOrder);
  orderRouter.get('/my/:id', requireAuth, requireRole('buyer'), orderController.getByIdForBuyer);
  app.use('/api/orders', orderRouter);

  const orderOrgRouter = Router();
  orderOrgRouter.patch('/:id/status', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.updateStatus);
  app.use('/api/orders/org', orderOrgRouter);

  // Delivery routes
  const delRouter = Router();
  delRouter.post('/', requireAuth, requireRole('wholesaler_admin'), deliveryController.assign);
  delRouter.get('/org', requireAuth, requireRole('wholesaler_admin'), deliveryController.listByOrg);
  delRouter.get('/mine', requireAuth, requireRole('delivery_operator'), deliveryController.listMine);
  delRouter.patch('/:id/delivered', requireAuth, requireRole('delivery_operator'), deliveryController.markDelivered);
  app.use('/api/deliveries', delRouter);

  app.use(errorHandler);
  return app;
}
