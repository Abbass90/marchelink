import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

// §19: 5 req/min/IP sur /api/auth/* (relaxed in dev)
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 30 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later',
  },
});

// §19: 20 req/min/IP sur /api/payments/webhook
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later',
  },
});
