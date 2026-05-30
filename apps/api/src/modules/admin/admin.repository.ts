import type { Knex } from 'knex';

const USER_COLUMNS = [
  'id', 'email', 'role', 'organization_id',
  'first_name', 'last_name', 'phone', 'created_at',
];

const ORG_COLUMNS = [
  'id', 'name', 'type', 'status', 'created_at',
];

const ORDER_COLUMNS = [
  'id', 'wholesaler_org_id', 'buyer_user_id',
  'status', 'total_xof', 'created_at',
];

export interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  organization_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: Date;
  org_name?: string | null;
}

export interface AdminOrgRow {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: Date;
  user_count: string;
}

export interface AdminOrderRow {
  id: string;
  wholesaler_org_id: string;
  buyer_user_id: string;
  status: string;
  total_xof: string;
  created_at: Date;
  buyer_name?: string;
  org_name?: string;
}

export interface PlatformStats {
  total_users: number;
  total_organizations: number;
  total_orders: number;
  total_revenue_xof: number;
  orders_by_status: Record<string, number>;
}

export class AdminRepository {
  constructor(private db: Knex) {}

  async getStats(): Promise<PlatformStats> {
    const [usersResult] = await this.db('users')
      .whereNull('deleted_at')
      .count('id as count');

    const [orgsResult] = await this.db('organizations')
      .whereNull('deleted_at')
      .count('id as count');

    const [ordersResult] = await this.db('orders')
      .whereNull('deleted_at')
      .count('id as count');

    const [revenueResult] = await this.db('orders')
      .whereNull('deleted_at')
      .whereIn('status', ['paid', 'shipped', 'delivered'])
      .sum('total_xof as total');

    const statusRows = await this.db('orders')
      .whereNull('deleted_at')
      .select('status')
      .count('id as count')
      .groupBy('status');

    const orders_by_status: Record<string, number> = {};
    for (const row of statusRows) {
      orders_by_status[row.status as string] = Number(row.count);
    }

    return {
      total_users: Number(usersResult?.count ?? 0),
      total_organizations: Number(orgsResult?.count ?? 0),
      total_orders: Number(ordersResult?.count ?? 0),
      total_revenue_xof: Number(revenueResult?.total ?? 0),
      orders_by_status,
    };
  }

  async listUsers(): Promise<AdminUserRow[]> {
    return this.db('users')
      .select([
        ...USER_COLUMNS.map(c => `users.${c}`),
        'organizations.name as org_name',
      ])
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
      .whereNull('users.deleted_at')
      .orderBy('users.created_at', 'desc') as Promise<AdminUserRow[]>;
  }

  async listOrganizations(): Promise<AdminOrgRow[]> {
    return this.db('organizations')
      .select([
        ...ORG_COLUMNS.map(c => `organizations.${c}`),
        this.db.raw('count(users.id) as user_count'),
      ])
      .leftJoin('users', function () {
        this.on('users.organization_id', '=', 'organizations.id')
          .andOnNull('users.deleted_at');
      })
      .whereNull('organizations.deleted_at')
      .groupBy(...ORG_COLUMNS.map(c => `organizations.${c}`))
      .orderBy('organizations.created_at', 'desc') as Promise<AdminOrgRow[]>;
  }

  async listOrders(): Promise<AdminOrderRow[]> {
    return this.db('orders')
      .select([
        ...ORDER_COLUMNS.map(c => `orders.${c}`),
        this.db.raw("users.first_name || ' ' || users.last_name as buyer_name"),
        'organizations.name as org_name',
      ])
      .leftJoin('users', 'orders.buyer_user_id', 'users.id')
      .leftJoin('organizations', 'orders.wholesaler_org_id', 'organizations.id')
      .whereNull('orders.deleted_at')
      .orderBy('orders.created_at', 'desc')
      .limit(50) as Promise<AdminOrderRow[]>;
  }
}
