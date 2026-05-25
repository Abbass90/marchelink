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
import { PaymentController } from '../payment.controller.js';
import { PaymentService } from '../payment.service.js';
import { PaymentRepository } from '../payment.repository.js';
import { webhookRateLimiter } from '../../../middleware/rate-limit.middleware.js';
import { getTestDb } from '../../auth/__tests__/setup.js';

export function createPaymentTestApp(options?: { enableWebhookRateLimit?: boolean }) {
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

  const paymentRepo = new PaymentRepository(db);
  const paymentService = new PaymentService(paymentRepo);
  const paymentController = new PaymentController(paymentService);

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
  app.use('/api/orders', orderRouter);

  // Wholesaler order status (needed to accept orders before payment)
  const orderOrgRouter = Router();
  orderOrgRouter.patch('/:id/status', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), orderController.updateStatus);
  app.use('/api/orders/org', orderOrgRouter);

  // Payment routes
  const payRouter = Router();
  payRouter.get('/my', requireAuth, requireRole('buyer'), paymentController.listByBuyer);
  payRouter.get('/org', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), paymentController.listByOrg);
  payRouter.post('/initiate', requireAuth, requireRole('buyer'), paymentController.initiate);
  if (options?.enableWebhookRateLimit) {
    payRouter.post('/webhook', webhookRateLimiter, paymentController.webhook);
  } else {
    payRouter.post('/webhook', paymentController.webhook);
  }
  app.use('/api/payments', payRouter);

  app.use(errorHandler);
  return app;
}
