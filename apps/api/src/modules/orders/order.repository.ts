import type { Knex } from 'knex';

export interface OrderRow {
  id: string;
  wholesaler_org_id: string;
  buyer_user_id: string;
  status: string;
  total_xof: string;
  payment_id: string | null;
  delivery_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price_xof: string;
  line_total_xof: string;
}

export interface CreateOrderData {
  wholesaler_org_id: string;
  buyer_user_id: string;
  total_xof: number;
  created_by: string;
}

export interface CreateOrderItemData {
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price_xof: number;
  line_total_xof: number;
  created_by: string;
}

const ORDER_COLUMNS = [
  'id', 'wholesaler_org_id', 'buyer_user_id', 'status',
  'total_xof', 'payment_id', 'delivery_id', 'created_at', 'updated_at',
];

const ORDER_ITEM_COLUMNS = [
  'id', 'order_id', 'product_id', 'quantity', 'unit_price_xof', 'line_total_xof',
];

export class OrderRepository {
  constructor(private db: Knex) {}

  async createOrder(data: CreateOrderData, trx?: Knex.Transaction): Promise<OrderRow> {
    const conn = trx ?? this.db;
    const [row] = await conn('orders')
      .insert(data)
      .returning(ORDER_COLUMNS);
    return row as OrderRow;
  }

  async createOrderItems(items: CreateOrderItemData[], trx?: Knex.Transaction): Promise<OrderItemRow[]> {
    const conn = trx ?? this.db;
    const rows = await conn('order_items')
      .insert(items)
      .returning(ORDER_ITEM_COLUMNS);
    return rows as OrderItemRow[];
  }

  async findByIdForWholesaler(orderId: string, orgId: string): Promise<OrderRow | undefined> {
    return this.db('orders')
      .select(ORDER_COLUMNS)
      .where({ id: orderId, wholesaler_org_id: orgId, deleted_at: null })
      .first() as Promise<OrderRow | undefined>;
  }

  async findByIdForBuyer(orderId: string, buyerUserId: string): Promise<OrderRow | undefined> {
    return this.db('orders')
      .select(ORDER_COLUMNS)
      .where({ id: orderId, buyer_user_id: buyerUserId, deleted_at: null })
      .first() as Promise<OrderRow | undefined>;
  }

  async findAllByOrg(orgId: string): Promise<OrderRow[]> {
    return this.db('orders')
      .select(ORDER_COLUMNS)
      .where({ wholesaler_org_id: orgId, deleted_at: null })
      .orderBy('created_at', 'desc') as Promise<OrderRow[]>;
  }

  async findAllByBuyer(buyerUserId: string): Promise<OrderRow[]> {
    return this.db('orders')
      .select(ORDER_COLUMNS)
      .where({ buyer_user_id: buyerUserId, deleted_at: null })
      .orderBy('created_at', 'desc') as Promise<OrderRow[]>;
  }

  async findItemsByOrderId(orderId: string): Promise<OrderItemRow[]> {
    return this.db('order_items')
      .select(ORDER_ITEM_COLUMNS)
      .where({ order_id: orderId, deleted_at: null }) as Promise<OrderItemRow[]>;
  }

  async updateStatus(orderId: string, orgId: string, status: string): Promise<OrderRow | undefined> {
    const [row] = await this.db('orders')
      .where({ id: orderId, wholesaler_org_id: orgId, deleted_at: null })
      .update({ status, updated_at: this.db.fn.now() })
      .returning(ORDER_COLUMNS);
    return row as OrderRow | undefined;
  }

  async updateStatusByBuyer(orderId: string, buyerUserId: string, status: string): Promise<OrderRow | undefined> {
    const [row] = await this.db('orders')
      .where({ id: orderId, buyer_user_id: buyerUserId, deleted_at: null })
      .update({ status, updated_at: this.db.fn.now() })
      .returning(ORDER_COLUMNS);
    return row as OrderRow | undefined;
  }

  async decrementStock(productId: string, quantity: number, trx: Knex.Transaction): Promise<number> {
    const updated = await trx('products')
      .where('id', productId)
      .andWhere('stock_qty', '>=', quantity)
      .andWhere('deleted_at', null)
      .decrement('stock_qty', quantity);
    return updated;
  }

  async getProductsByIds(productIds: string[], orgId: string): Promise<Array<{ id: string; price_xof: string; stock_qty: number; organization_id: string }>> {
    return this.db('products')
      .select('id', 'price_xof', 'stock_qty', 'organization_id')
      .whereIn('id', productIds)
      .andWhere({ organization_id: orgId, deleted_at: null });
  }
}
