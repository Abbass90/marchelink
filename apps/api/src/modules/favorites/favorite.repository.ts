import type { Knex } from 'knex';

/* ── Row types ───────────────────────────────────────── */

export interface FavoriteRow {
  id: string;
  buyer_user_id: string;
  product_id: string;
  created_at: Date;
  deleted_at: Date | null;
}

export interface FavoriteItemRow {
  id: string;           // favorites.id
  product_id: string;
  product_name: string;
  product_sku: string;
  product_price_xof: string; // BIGINT → string
  product_stock_qty: number;
  product_unit: string;
  product_category: string;
  product_image_url: string | null;
  product_organization_id: string;
  org_name: string;
  created_at: Date;
}

/* ── Repository ──────────────────────────────────────── */

export class FavoriteRepository {
  constructor(private readonly db: Knex) {}

  /** Check if a product is currently favorited by the buyer. */
  async isFavorited(buyerUserId: string, productId: string): Promise<boolean> {
    const row = await this.db('favorites')
      .where({ buyer_user_id: buyerUserId, product_id: productId })
      .whereNull('deleted_at')
      .first();
    return !!row;
  }

  /**
   * List all active favorites for a buyer, joined with product + org data.
   * CLAUDE.md §4: always filters by buyer_user_id.
   */
  async list(buyerUserId: string): Promise<FavoriteItemRow[]> {
    return this.db('favorites as f')
      .join('products as p', 'f.product_id', 'p.id')
      .join('organizations as o', 'p.organization_id', 'o.id')
      .where('f.buyer_user_id', buyerUserId)
      .whereNull('f.deleted_at')
      .whereNull('p.deleted_at')
      .select([
        'f.id',
        'f.product_id',
        'p.name as product_name',
        'p.sku as product_sku',
        this.db.raw('p.price_xof as product_price_xof'),
        'p.stock_qty as product_stock_qty',
        'p.unit as product_unit',
        'p.category as product_category',
        'p.image_url as product_image_url',
        'p.organization_id as product_organization_id',
        'o.name as org_name',
        'f.created_at',
      ])
      .orderBy('f.created_at', 'desc') as Promise<FavoriteItemRow[]>;
  }

  /**
   * Add a product to favorites (idempotent: restores if soft-deleted).
   * Returns the favorites row id.
   */
  async add(buyerUserId: string, productId: string, userId?: string): Promise<string> {
    // Check if a row exists (active or soft-deleted)
    const existing = await this.db('favorites')
      .where({ buyer_user_id: buyerUserId, product_id: productId })
      .first() as FavoriteRow | undefined;

    if (existing) {
      if (!existing.deleted_at) {
        // Already an active favorite — idempotent no-op
        return existing.id;
      }
      // Restore soft-deleted row
      await this.db('favorites')
        .where({ id: existing.id })
        .update({
          deleted_at: null,
          updated_at: this.db.fn.now(),
          updated_by: userId ?? null,
        });
      return existing.id;
    }

    const [row] = await this.db('favorites')
      .insert({
        buyer_user_id: buyerUserId,
        product_id: productId,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .returning(['id']) as [{ id: string }];
    return row.id;
  }

  /**
   * Remove a favorite (soft delete).
   * Returns false if the product was not in the buyer's favorites.
   */
  async remove(buyerUserId: string, productId: string): Promise<boolean> {
    const count = await this.db('favorites')
      .where({ buyer_user_id: buyerUserId, product_id: productId })
      .whereNull('deleted_at')
      .update({ deleted_at: this.db.fn.now(), updated_at: this.db.fn.now() });
    return count > 0;
  }
}
