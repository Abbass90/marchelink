import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp, type Options } from 'pino-http';
import { correlationId } from './middleware/correlation-id.middleware.js';
import { errorHandler } from './middleware/error-handler.middleware.js';
import { authRateLimiter, assistantRateLimiter } from './middleware/rate-limit.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { productsRouter } from './modules/products/product.routes.js';
import { ordersRouter } from './modules/orders/order.routes.js';
import { paymentsRouter } from './modules/payments/payment.routes.js';
import { deliveriesRouter } from './modules/deliveries/delivery.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { assistantRouter } from './modules/assistant/assistant.routes.js';
import { logger } from './config/logger.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// CLAUDE.md §17 : Helmet à la racine.
app.use(helmet());

// CLAUDE.md §18 : whitelist CORS explicite, jamais '*'.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(correlationId());
// Cast : `pino-http` embarque sa propre version des types `pino`, d'où un
// léger décalage structurel avec notre instance `logger`. Le cast est sûr.
app.use(pinoHttp({ logger } as unknown as Options));

// Health check (Session 7 — Docker healthcheck cible cet endpoint)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Vertical slices
app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chat', chatRouter);
app.use('/api/assistant', assistantRateLimiter, assistantRouter);

// Error handler centralisé (CLAUDE.md §21)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API up');
});
