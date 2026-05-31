import { Router } from 'express';
import multer from 'multer';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';
import { ProductRepository } from './product.repository.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { db } from '../../db/knex.js';

const repo = new ProductRepository(db);
const service = new ProductService(repo);
const controller = new ProductController(service);

// Multer : mémoire (pas de disque), 5 Mo max, images uniquement
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

export const productsRouter = Router();

// ⚠️ /upload-image DOIT être avant /:id (sinon Express traite "upload-image" comme un :id)
productsRouter.post(
  '/upload-image',
  requireAuth,
  requireRole('wholesaler_admin', 'wholesaler_seller'),
  upload.single('image'),
  controller.uploadImage,
);

// Buyer: browse all products with filters + pagination
productsRouter.get('/browse', requireAuth, controller.browse);

// Buyer/anyone authenticated: get product detail
productsRouter.get('/:id', requireAuth, controller.getById);

// Wholesaler: CRUD on own products
productsRouter.get('/', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), controller.listByOrg);
productsRouter.post('/', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), controller.create);
productsRouter.patch('/:id', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), controller.update);
productsRouter.delete('/:id', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), controller.remove);
