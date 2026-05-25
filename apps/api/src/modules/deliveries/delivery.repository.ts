import type { Knex } from 'knex';

export interface DeliveryRow {
  id: string;
  order_id: string;
  wholesaler_org_id: string;
  assigned_to_user_id: string;
  status: string;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const DELIVERY_COLUMNS = [
  'id', 'order_id', 'wholesaler_org_id', 'assigned_to_user_id',
  'status', 'completed_at', 'created_at', 'updated_at',
];

export class DeliveryRepository {
  constructor(private db: Knex) {}

  async create(data: {
    order_id: string;
    wholesaler_org_id: string;
    assigned_to_user_id: string;
    created_by: string;
  }): Promise<DeliveryRow> {
    const [row] = await this.db('deliveries')
      .insert(data)
      .returning(DELIVERY_COLUMNS);
    return row as DeliveryRow;
  }

  async findByIdForOrg(id: string, orgId: string): Promise<DeliveryRow | undefined> {
    return this.db('deliveries')
      .select(DELIVERY_COLUMNS)
      .where({ id, wholesaler_org_id: orgId, deleted_at: null })
      .first() as Promise<DeliveryRow | undefined>;
  }

  async findByIdForOperator(id: string, operatorUserId: string): Promise<DeliveryRow | undefined> {
    return this.db('deliveries')
      .select(DELIVERY_COLUMNS)
      .where({ id, assigned_to_user_id: operatorUserId, deleted_at: null })
      .first() as Promise<DeliveryRow | undefined>;
  }

  async findAllByOrg(orgId: string): Promise<DeliveryRow[]> {
    return this.db('deliveries')
      .select(DELIVERY_COLUMNS)
      .where({ wholesaler_org_id: orgId, deleted_at: null })
      .orderBy('created_at', 'desc') as Promise<DeliveryRow[]>;
  }

  async findAllByOperator(operatorUserId: string): Promise<DeliveryRow[]> {
    return this.db('deliveries')
      .select(DELIVERY_COLUMNS)
      .where({ assigned_to_user_id: operatorUserId, deleted_at: null })
      .orderBy('created_at', 'desc') as Promise<DeliveryRow[]>;
  }

  async markDelivered(id: string, operatorUserId: string): Promise<DeliveryRow | undefined> {
    const [row] = await this.db('deliveries')
      .where({ id, assigned_to_user_id: operatorUserId, deleted_at: null })
      .update({ status: 'delivered', completed_at: this.db.fn.now(), updated_at: this.db.fn.now() })
      .returning(DELIVERY_COLUMNS);
    return row as DeliveryRow | undefined;
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    await this.db('orders')
      .where({ id: orderId })
      .update({ status, updated_at: this.db.fn.now() });
  }

  async updateOrderDeliveryId(orderId: string, deliveryId: string): Promise<void> {
    await this.db('orders')
      .where({ id: orderId })
      .update({ delivery_id: deliveryId, updated_at: this.db.fn.now() });
  }

  async getOrderForOrg(orderId: string, orgId: string): Promise<{ id: string; status: string; wholesaler_org_id: string } | undefined> {
    return this.db('orders')
      .select('id', 'status', 'wholesaler_org_id')
      .where({ id: orderId, wholesaler_org_id: orgId, deleted_at: null })
      .first();
  }

  async getOperatorInOrg(userId: string, orgId: string): Promise<{ id: string; role: string } | undefined> {
    return this.db('users')
      .select('id', 'role')
      .where({ id: userId, organization_id: orgId, role: 'delivery_operator' })
      .whereNull('deleted_at')
      .first();
  }

  async findByOrderId(orderId: string): Promise<DeliveryRow | undefined> {
    return this.db('deliveries')
      .select(DELIVERY_COLUMNS)
      .where({ order_id: orderId, deleted_at: null })
      .first() as Promise<DeliveryRow | undefined>;
  }

  async findAvailableForOrg(orgId: string): Promise<{ id: string; wholesaler_org_id: string; buyer_user_id: string; status: string; total_xof: string; created_at: Date }[]> {
    return this.db('orders')
      .select('id', 'wholesaler_org_id', 'buyer_user_id', 'status', 'total_xof', 'created_at')
      .where({ wholesaler_org_id: orgId, status: 'paid', deleted_at: null })
      .whereNull('delivery_id')
      .orderBy('created_at', 'asc');
  }
}
