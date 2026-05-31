import type { Request, Response, NextFunction } from 'express';
import { FavoriteService } from './favorite.service.js';
import { ProductIdParamSchema } from './favorite.schema.js';
import { ValidationError } from '../../errors/index.js';

export class FavoriteController {
  constructor(private readonly service: FavoriteService) {}

  /** GET /api/favorites — list buyer's favorites */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buyerUserId = req.user!.id;
      const items = await this.service.list(buyerUserId);
      res.json(items);
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/favorites/:productId — add to favorites */
  add = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ProductIdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid params');
      }
      const buyerUserId = req.user!.id;
      const result = await this.service.add(buyerUserId, parsed.data.productId, buyerUserId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /** DELETE /api/favorites/:productId — remove from favorites */
  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ProductIdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid params');
      }
      const buyerUserId = req.user!.id;
      await this.service.remove(buyerUserId, parsed.data.productId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
