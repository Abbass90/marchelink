import type { Knex } from 'knex';

export interface DashboardStats {
  revenue_today_xof: number;
  orders_today: number;
  orders_pending: number;
  low_stock_products: Array<{ id: string; name: string; sku: string; stock_qty: number }>;
}

export class DashboardRepository {
  constructor(private db: Knex) {}

  async getRevenueToday(orgId: string): Promise<number> {
    const result = await this.db('orders')
      .where({ wholesaler_org_id: orgId, deleted_at: null })
      .whereIn('status', ['paid', 'delivered'])
      .whereRaw("created_at >= CURRENT_DATE")
      .sum('total_xof as total')
      .first();
    return Number(result?.total ?? 0);
  }

  async getOrdersCountToday(orgId: string): Promise<number> {
    const result = await this.db('orders')
      .where({ wholesaler_org_id: orgId, deleted_at: null })
      .whereRaw("created_at >= CURRENT_DATE")
      .count('id as count')
      .first();
    return Number(result?.count ?? 0);
  }

  async getOrdersPendingCount(orgId: string): Promise<number> {
    const result = await this.db('orders')
      .where({ wholesaler_org_id: orgId, status: 'pending', deleted_at: null })
      .count('id as count')
      .first();
    return Number(result?.count ?? 0);
  }

  async getLowStockProducts(orgId: string, threshold = 10): Promise<Array<{ id: string; name: string; sku: string; stock_qty: number }>> {
    return this.db('products')
      .select('id', 'name', 'sku', 'stock_qty')
      .where({ organization_id: orgId, deleted_at: null })
      .andWhere('stock_qty', '<=', threshold)
      .orderBy('stock_qty', 'asc');
  }
}
