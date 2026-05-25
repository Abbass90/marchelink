import type { Knex } from 'knex';

export interface PaymentRow {
  id: string;
  order_id: string;
  wholesaler_org_id: string;
  provider: string;
  provider_ref: string | null;
  status: string;
  amount_xof: string;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
}

const PAYMENT_COLUMNS = [
  'id', 'order_id', 'wholesaler_org_id', 'provider', 'provider_ref',
  'status', 'amount_xof', 'idempotency_key', 'created_at', 'updated_at',
];

export class PaymentRepository {
  constructor(private db: Knex) {}

  async create(data: {
    order_id: string;
    wholesaler_org_id: string;
    amount_xof: number;
    idempotency_key: string;
    created_by: string;
  }): Promise<PaymentRow> {
    const [row] = await this.db('payments')
      .insert(data)
      .returning(PAYMENT_COLUMNS);
    return row as PaymentRow;
  }

  async findByIdempotencyKey(key: string): Promise<PaymentRow | undefined> {
    return this.db('payments')
      .select(PAYMENT_COLUMNS)
      .where({ idempotency_key: key, deleted_at: null })
      .first() as Promise<PaymentRow | undefined>;
  }

  async findByOrderId(orderId: string): Promise<PaymentRow | undefined> {
    return this.db('payments')
      .select(PAYMENT_COLUMNS)
      .where({ order_id: orderId, deleted_at: null })
      .first() as Promise<PaymentRow | undefined>;
  }

  async updateStatus(id: string, status: string, providerRef: string | null): Promise<PaymentRow | undefined> {
    const [row] = await this.db('payments')
      .where({ id, deleted_at: null })
      .update({ status, provider_ref: providerRef, updated_at: this.db.fn.now() })
      .returning(PAYMENT_COLUMNS);
    return row as PaymentRow | undefined;
  }

  async findByBuyerId(buyerUserId: string): Promise<PaymentRow[]> {
    const rows = await this.db('payments')
      .join('orders', 'payments.order_id', 'orders.id')
      .select(PAYMENT_COLUMNS.map((c) => `payments.${c} as ${c}`))
      .where('orders.buyer_user_id', buyerUserId)
      .whereNull('payments.deleted_at')
      .orderBy('payments.created_at', 'desc');
    return rows as PaymentRow[];
  }

  async findByOrgId(orgId: string): Promise<PaymentRow[]> {
    return this.db<PaymentRow>('payments')
      .select(PAYMENT_COLUMNS)
      .where({ wholesaler_org_id: orgId, deleted_at: null })
      .orderBy('created_at', 'desc');
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    await this.db('orders')
      .where({ id: orderId })
      .update({ status, updated_at: this.db.fn.now() });
  }

  async getOrderById(orderId: string, buyerUserId: string): Promise<{ id: string; wholesaler_org_id: string; buyer_user_id: string; status: string; total_xof: string } | undefined> {
    return this.db('orders')
      .select('id', 'wholesaler_org_id', 'buyer_user_id', 'status', 'total_xof')
      .where({ id: orderId, buyer_user_id: buyerUserId, deleted_at: null })
      .first();
  }
}
