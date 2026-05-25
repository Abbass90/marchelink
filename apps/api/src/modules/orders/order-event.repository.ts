import type { Knex } from 'knex';

export interface OrderEventRow {
  id: string;
  order_id: string;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: Date | null;
}

export interface InsertEventData {
  order_id: string;
  status: string;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

export class OrderEventRepository {
  constructor(private readonly db: Knex) {}

  async insertEvent(data: InsertEventData, trx?: Knex.Transaction): Promise<OrderEventRow> {
    const qb = trx ?? this.db;
    const [row] = await qb<OrderEventRow>('order_events')
      .insert({
        order_id: data.order_id,
        status: data.status,
        notes: data.notes ?? null,
        created_by: data.created_by ?? null,
        updated_by: data.updated_by ?? null,
      })
      .returning([
        'id', 'order_id', 'status', 'notes',
        'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
      ]);
    return row as OrderEventRow;
  }

  async findByOrderId(orderId: string): Promise<OrderEventRow[]> {
    return this.db<OrderEventRow>('order_events')
      .select([
        'id', 'order_id', 'status', 'notes',
        'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
      ])
      .where({ order_id: orderId, deleted_at: null })
      .orderBy('created_at', 'asc');
  }
}
