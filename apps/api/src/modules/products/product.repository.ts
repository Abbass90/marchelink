import type { Knex } from 'knex';

export interface ProductRow {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  description: string | null;
  price_xof: string; // BIGINT comes as string from pg
  stock_qty: number;
  unit: string;
  image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = [
  'id', 'organization_id', 'sku', 'name', 'description',
  'price_xof', 'stock_qty', 'unit', 'image_url', 'created_at', 'updated_at',
] as const;

export interface BrowseProductRow extends ProductRow {
  org_name: string;
}

export interface BrowseParams {
  q?: string;
  org_id?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  sort?: 'price_asc' | 'price_desc' | 'name' | 'newest';
  page?: number;
  limit?: number;
}

export interface BrowsePage {
  data: BrowseProductRow[];
  total: number;
  page: number;
  limit: number;
}

export class ProductRepository {
  constructor(private readonly db: Knex) {}

  async findAllByOrg(organizationId: string): Promise<ProductRow[]> {
    return this.db('products')
      .select(COLUMNS)
      .where({ organization_id: organizationId })
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc');
  }

  async browse(params: BrowseParams): Promise<BrowsePage> {
    const limit = Math.min(params.limit ?? 20, 100);
    const page = Math.max(params.page ?? 1, 1);
    const offset = (page - 1) * limit;

    const buildBase = () => {
      let qb = this.db('products as p')
        .join('organizations as o', 'p.organization_id', 'o.id')
        .whereNull('p.deleted_at');

      if (params.q) {
        qb = qb.where((b) => {
          b.whereRaw('p.name ILIKE ?', [`%${params.q}%`])
            .orWhereRaw('p.sku ILIKE ?', [`%${params.q}%`]);
        });
      }
      if (params.org_id) qb = qb.where('p.organization_id', params.org_id);
      if (params.min_price !== undefined) qb = qb.where('p.price_xof', '>=', params.min_price);
      if (params.max_price !== undefined) qb = qb.where('p.price_xof', '<=', params.max_price);
      if (params.in_stock) qb = qb.where('p.stock_qty', '>', 0);
      return qb;
    };

    const countRow = await buildBase().count('p.id as count').first();
    const total = Number((countRow as { count: string | number } | undefined)?.count ?? 0);

    const orderMap: Record<string, [string, string]> = {
      price_asc: ['p.price_xof', 'asc'],
      price_desc: ['p.price_xof', 'desc'],
      name: ['p.name', 'asc'],
      newest: ['p.created_at', 'desc'],
    };
    const [orderCol, orderDir] = orderMap[params.sort ?? 'newest'] ?? ['p.created_at', 'desc'];

    const rows = await buildBase()
      .select([
        'p.id', 'p.organization_id', 'p.sku', 'p.name', 'p.description',
        'p.price_xof', 'p.stock_qty', 'p.unit', 'p.image_url',
        'p.created_at', 'p.updated_at',
        this.db.raw('o.name as org_name'),
      ])
      .orderBy(orderCol, orderDir as 'asc' | 'desc')
      .limit(limit)
      .offset(offset);

    return { data: rows as BrowseProductRow[], total, page, limit };
  }

  async findAllActive(): Promise<ProductRow[]> {
    return this.db('products')
      .select(COLUMNS)
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc');
  }

  async findById(id: string, organizationId: string): Promise<ProductRow | undefined> {
    return this.db('products')
      .select(COLUMNS)
      .where({ id, organization_id: organizationId })
      .whereNull('deleted_at')
      .first();
  }

  async findByIdPublic(id: string): Promise<ProductRow | undefined> {
    return this.db('products')
      .select(COLUMNS)
      .where({ id })
      .whereNull('deleted_at')
      .first();
  }

  async create(organizationId: string, data: {
    sku: string;
    name: string;
    description?: string;
    price_xof: number;
    stock_qty: number;
    unit: string;
    image_url?: string;
    created_by?: string;
  }): Promise<ProductRow> {
    const [product] = await this.db('products')
      .insert({
        organization_id: organizationId,
        sku: data.sku,
        name: data.name,
        description: data.description ?? null,
        price_xof: data.price_xof,
        stock_qty: data.stock_qty,
        unit: data.unit,
        image_url: data.image_url ?? null,
        created_by: data.created_by ?? null,
        updated_by: data.created_by ?? null,
      })
      .returning(COLUMNS as unknown as string[]);
    return product as ProductRow;
  }

  async update(id: string, organizationId: string, data: Record<string, unknown>, updatedBy?: string): Promise<ProductRow | undefined> {
    const [product] = await this.db('products')
      .where({ id, organization_id: organizationId })
      .whereNull('deleted_at')
      .update({
        ...data,
        updated_at: this.db.fn.now(),
        updated_by: updatedBy ?? null,
      })
      .returning(COLUMNS as unknown as string[]);
    return product as ProductRow | undefined;
  }

  async softDelete(id: string, organizationId: string): Promise<boolean> {
    const count = await this.db('products')
      .where({ id, organization_id: organizationId })
      .whereNull('deleted_at')
      .update({ deleted_at: this.db.fn.now() });
    return count > 0;
  }
}
