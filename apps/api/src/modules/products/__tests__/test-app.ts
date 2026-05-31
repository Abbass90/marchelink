import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { Router } from 'express';
import { correlationId } from '../../../middleware/correlation-id.middleware.js';
import { errorHandler } from '../../../middleware/error-handler.middleware.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { requireRole } from '../../../middleware/role.middleware.js';
import { AuthController } from '../../auth/auth.controller.js';
import { AuthService } from '../../auth/auth.service.js';
import { AuthRepository } from '../../auth/auth.repository.js';
import { ProductController } from '../product.controller.js';
import { ProductService } from '../product.service.js';
import { ProductRepository } from '../product.repository.js';
import { getTestDb } from '../../auth/__tests__/setup.js';

export function createProductTestApp() {
  const db = getTestDb();

  // Auth
  const authRepo = new AuthRepository(db);
  const authService = new AuthService(authRepo);
  const authController = new AuthController(authService);

  // Products
  const productRepo = new ProductRepository(db);
  const productService = new ProductService(productRepo);
  const productController = new ProductController(productService);

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(correlationId());

  // Auth routes (needed to login in tests)
  const authRouter = Router();
  authRouter.post('/register', authController.register);
  authRouter.post('/login', authController.login);
  app.use('/api/auth', authRouter);

  // Multer : mirror la config production (mémoire, 5 Mo, images uniquement)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Seules les images JPEG, PNG et WebP sont acceptées'));
      }
    },
  });

  // Product routes
  const prodRouter = Router();
  // ⚠️ /upload-image AVANT /:id (sinon Express traite "upload-image" comme un :id)
  prodRouter.post(
    '/upload-image',
    requireAuth,
    requireRole('wholesaler_admin', 'wholesaler_seller'),
    upload.single('image'),
    productController.uploadImage,
  );
  prodRouter.get('/browse', requireAuth, productController.browse);
  prodRouter.get('/:id', requireAuth, productController.getById);
  prodRouter.get('/', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), productController.listByOrg);
  prodRouter.post('/', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), productController.create);
  prodRouter.patch('/:id', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), productController.update);
  prodRouter.delete('/:id', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), productController.remove);
  app.use('/api/products', prodRouter);

  app.use(errorHandler);
  return app;
}
