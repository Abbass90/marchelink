import type { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service.js';
import { CreateProductSchema, UpdateProductSchema } from './product.schema.js';
import { ValidationError } from '../../errors/index.js';
import type { BrowseParams } from './product.repository.js';
import { getCloudinary } from '../../config/cloudinary.js';

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
      // exactOptionalPropertyTypes : on n'ajoute une clé optionnelle que si
      // elle a une valeur définie (jamais `key: undefined`).
      const params: BrowseParams = { in_stock: q.in_stock === 'true' };
      if (typeof q.q === 'string' && q.q) params.q = q.q;
      if (typeof q.org_id === 'string' && q.org_id) params.org_id = q.org_id;
      if (typeof q.category === 'string' && q.category) params.category = q.category;
      if (q.min_price) params.min_price = Number(q.min_price);
      if (q.max_price) params.max_price = Number(q.max_price);
      if (q.sort) params.sort = q.sort as NonNullable<BrowseParams['sort']>;
      if (q.page) params.page = Number(q.page);
      if (q.limit) params.limit = Number(q.limit);
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

  uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError('Aucun fichier reçu');
      }
      const buffer = req.file.buffer;
      const cld = getCloudinary();
      const url = await new Promise<string>((resolve, reject) => {
        cld.uploader.upload_stream(
          {
            folder: 'marchelink/products',
            resource_type: 'image',
            // Redimensionne côté serveur : max 800×800, qualité auto
            transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
          },
          (err, result) => {
            if (err ?? !result) {
              reject(err ?? new Error('Upload Cloudinary échoué'));
            } else {
              resolve(result.secure_url);
            }
          },
        ).end(buffer);
      });
      res.json({ url });
    } catch (err) {
      next(err);
    }
  };
}
