import type { Knex } from 'knex';
import { FavoriteRepository, type FavoriteItemRow } from './favorite.repository.js';
import { NotFoundError } from '../../errors/index.js';

export class FavoriteService {
  constructor(
    private readonly repo: FavoriteRepository,
    private readonly db: Knex,
  ) {}

  async list(buyerUserId: string): Promise<FavoriteItemRow[]> {
    return this.repo.list(buyerUserId);
  }

  async add(buyerUserId: string, productId: string, userId?: string): Promise<{ id: string }> {
    const row = await this.db('products')
      .where({ id: productId })
      .whereNull('deleted_at')
      .first();
    if (!row) throw new NotFoundError('Product not found');
    const id = await this.repo.add(buyerUserId, productId, userId);
    return { id };
  }

  async remove(buyerUserId: string, productId: string): Promise<void> {
    const removed = await this.repo.remove(buyerUserId, productId);
    if (!removed) throw new NotFoundError('Favorite not found');
  }
}
