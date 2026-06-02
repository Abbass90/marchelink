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
import { OrderController } from '../order.controller.js';
import { OrderService } from '../order.service.js';
import { OrderRepository } from '../order.repository.js';
import { OrderEventRepository } from '../order-event.repository.js';
import { ProductController } from '../../products/product.controller.js';
import { ProductService } from '../../products/product.service.js';
import { ProductRepository } from '../../products/product.repository.js';
import { getTestDb } from '../../auth/__tests__/setup.js';

export function createOrderTestApp() {
  const db = getTestDb();

  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo);
  const authController = new AuthController(authService);

  const productRepo = new ProductRepository(db);
  const productService = new ProductService(productRepo);
  const productController = new ProductController(productService);

  const orderRepo = new OrderRepository(db);
  const eventRepo = new OrderEventRepository(db);
  const orderService = new OrderService(orderRepo, db, eventRepo);
  const orderController = new OrderController(orderService);

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(correlationId());

  // Auth routes
  const authRouter = Router();
  authRouter.post('/register', authController.register);
  authRouter.post('/login', authController.login);
  app.use('/api/auth', authRouter);

  // Product routes (needed to create products for orders)
  const prodRouter = Router();
  prodRouter.post('/', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), productController.create);
  app.use('/api/products', prodRouter);

  // Order routes
  const orderRouter = Router();
  orderRouter.post('/', requireAuth, requireRole('buyer'), orderController.placeOrder);
  orderRouter.get('/my', requireAuth, requireRole('buyer'), orderController.listByBuyer);
  orderRouter.get('/my/:id', requireAuth, requireRole('buyer'), orderController.getByIdForBuyer);
  orderRouter.get('/my/:id/detail', requireAuth, requireRole('buyer'), orderController.getOrderDetailForBuyer);
  orderRouter.patch('/my/:id/cancel', requireAuth, requireRole('buyer'), orderController.cancelOrder);
  orderRouter.get('/org', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.listByOrg);
  orderRouter.get('/org/:id', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.getByIdForWholesaler);
  orderRouter.patch('/org/:id/status', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.updateStatus);
  orderRouter.patch('/org/:id/delivery-mode', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.setDeliveryMode);
  app.use('/api/orders', orderRouter);

  app.use(errorHandler);
  return app;
}
