import { DashboardRepository, type DashboardStats } from './dashboard.repository.js';

export class DashboardService {
  constructor(private repo: DashboardRepository) {}

  async getStats(orgId: string): Promise<DashboardStats> {
    const [revenueToday, ordersToday, ordersPending, lowStockProducts] = await Promise.all([
      this.repo.getRevenueToday(orgId),
      this.repo.getOrdersCountToday(orgId),
      this.repo.getOrdersPendingCount(orgId),
      this.repo.getLowStockProducts(orgId),
    ]);

    return {
      revenue_today_xof: revenueToday,
      orders_today: ordersToday,
      orders_pending: ordersPending,
      low_stock_products: lowStockProducts,
    };
  }
}
