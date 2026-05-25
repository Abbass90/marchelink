import { Router } from 'express';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';
import { ProductRepository } from './product.repository.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { db } from '../../db/knex.js';

const repo = new ProductRepository(db);
const service = new ProductService(repo);
const controller = new ProductController(service);

export const productsRouter = Router();

// Buyer: browse all products with filters + pagination
productsRouter.get('/browse', requireAuth, controller.browse);

// Buyer/anyone authenticated: get product detail
productsRouter.get('/:id', requireAuth, controller.getById);

// Wholesaler: CRUD on own products
productsRouter.get('/', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), controller.listByOrg);
productsRouter.post('/', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), controller.create);
productsRouter.patch('/:id', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), controller.update);
productsRouter.delete('/:id', requireAuth, requireRole('wholesaler_admin', 'wholesaler_seller'), controller.remove);
