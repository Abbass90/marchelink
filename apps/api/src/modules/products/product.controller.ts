import type { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service.js';
import { CreateProductSchema, UpdateProductSchema } from './product.schema.js';
import { ValidationError } from '../../errors/index.js';
import type { BrowseParams } from './product.repository.js';

export class ProductController {
  constructor(private readonly service: ProductService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const orgId = req.user!.organization_id!;
      const product = await this.service.createProduct(orgId, parsed.data, req.user!.id);
      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = UpdateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const orgId = req.user!.organization_id!;
      const product = await this.service.updateProduct(req.params.id!, orgId, parsed.data, req.user!.id);
      res.json(product);
    } catch (err) {
      next(err);
    }
  };

  listByOrg = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.organization_id!;
      const products = await this.service.listByOrg(orgId);
      res.json(products);
    } catch (err) {
      next(err);
    }
  };

  listAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await this.service.listAll();
      res.json(products);
    } catch (err) {
      next(err);
    }
  };

  browse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = req.query;
      const params: BrowseParams = {
        q: typeof q.q === 'string' && q.q ? q.q : undefined,
        org_id: typeof q.org_id === 'string' && q.org_id ? q.org_id : undefined,
        min_price: q.min_price ? Number(q.min_price) : undefined,
        max_price: q.max_price ? Number(q.max_price) : undefined,
        in_stock: q.in_stock === 'true',
        sort: q.sort as BrowseParams['sort'],
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      };
      const result = await this.service.browse(params);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.service.getByIdPublic(req.params.id!);
      res.json(product);
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.organization_id!;
      await this.service.deleteProduct(req.params.id!, orgId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };
}
