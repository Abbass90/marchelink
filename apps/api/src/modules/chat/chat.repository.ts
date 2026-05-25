import type { Knex } from 'knex';

/* ── Row types ────────────────────────────────────────── */

export interface ConversationRow {
  id: string;
  buyer_user_id: string;
  wholesaler_org_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationWithMeta extends ConversationRow {
  org_name: string;
  buyer_name: string;
  last_message_body: string | null;
  last_message_at: Date | null;
  unread_count: string; // PG COUNT returns string
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  read_at: Date | null;
  created_at: Date;
}

export interface PaginatedMessages {
  data: MessageRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateMessageData {
  conversation_id: string;
  sender_user_id: string;
  body: string;
  created_by: string;
}

/* ── Column lists ─────────────────────────────────────── */

const CONV_COLUMNS = [
  'id', 'buyer_user_id', 'wholesaler_org_id', 'created_at', 'updated_at',
];

const MSG_COLUMNS = [
  'id', 'conversation_id', 'sender_user_id', 'body', 'read_at', 'created_at',
];

/* ── Repository ───────────────────────────────────────── */

export class ChatRepository {
  constructor(private db: Knex) {}

  /* ── Conversations ────────────────────────────────── */

  async findOrCreate(buyerUserId: string, wholesalerOrgId: string): Promise<ConversationRow> {
    // Idempotent: INSERT ignore on conflict, then fetch
    await this.db('conversations')
      .insert({ buyer_user_id: buyerUserId, wholesaler_org_id: wholesalerOrgId, created_by: buyerUserId })
      .onConflict(['buyer_user_id', 'wholesaler_org_id'])
      .ignore();

    const row = await this.db('conversations')
      .select(CONV_COLUMNS)
      .where({ buyer_user_id: buyerUserId, wholesaler_org_id: wholesalerOrgId, deleted_at: null })
      .first();
    return row as ConversationRow;
  }

  async findByIdForBuyer(convId: string, buyerUserId: string): Promise<ConversationRow | undefined> {
    return this.db('conversations')
      .select(CONV_COLUMNS)
      .where({ id: convId, buyer_user_id: buyerUserId, deleted_at: null })
      .first() as Promise<ConversationRow | undefined>;
  }

  async findByIdForOrg(convId: string, orgId: string): Promise<ConversationRow | undefined> {
    return this.db('conversations')
      .select(CONV_COLUMNS)
      .where({ id: convId, wholesaler_org_id: orgId, deleted_at: null })
      .first() as Promise<ConversationRow | undefined>;
  }

  async findByBuyer(buyerUserId: string): Promise<ConversationWithMeta[]> {
    const rows = await this.db('conversations as c')
      .select([
        'c.id', 'c.buyer_user_id', 'c.wholesaler_org_id', 'c.created_at', 'c.updated_at',
        'o.name as org_name',
        this.db.raw("u.first_name || ' ' || u.last_name as buyer_name"),
        this.db('messages').select('body')
          .where('conversation_id', this.db.ref('c.id')).whereNull('deleted_at')
          .orderBy('created_at', 'desc').limit(1).as('last_message_body'),
        this.db('messages').select('created_at')
          .where('conversation_id', this.db.ref('c.id')).whereNull('deleted_at')
          .orderBy('created_at', 'desc').limit(1).as('last_message_at'),
        this.db('messages').count('id')
          .where('conversation_id', this.db.ref('c.id'))
          .whereNot('sender_user_id', buyerUserId)
          .whereNull('deleted_at').whereNull('read_at').as('unread_count'),
      ])
      .join('organizations as o', 'c.wholesaler_org_id', 'o.id')
      .join('users as u', 'c.buyer_user_id', 'u.id')
      .where({ 'c.buyer_user_id': buyerUserId, 'c.deleted_at': null })
      .orderByRaw('last_message_at DESC NULLS LAST, c.created_at DESC');
    return rows as ConversationWithMeta[];
  }

  async findByOrg(orgId: string): Promise<ConversationWithMeta[]> {
    const rows = await this.db('conversations as c')
      .select([
        'c.id', 'c.buyer_user_id', 'c.wholesaler_org_id', 'c.created_at', 'c.updated_at',
        'o.name as org_name',
        this.db.raw("u.first_name || ' ' || u.last_name as buyer_name"),
        this.db('messages').select('body')
          .where('conversation_id', this.db.ref('c.id')).whereNull('deleted_at')
          .orderBy('created_at', 'desc').limit(1).as('last_message_body'),
        this.db('messages').select('created_at')
          .where('conversation_id', this.db.ref('c.id')).whereNull('deleted_at')
          .orderBy('created_at', 'desc').limit(1).as('last_message_at'),
        this.db('messages').count('id')
          .where('conversation_id', this.db.ref('c.id'))
          .where('sender_user_id', this.db.ref('c.buyer_user_id'))
          .whereNull('deleted_at').whereNull('read_at').as('unread_count'),
      ])
      .join('organizations as o', 'c.wholesaler_org_id', 'o.id')
      .join('users as u', 'c.buyer_user_id', 'u.id')
      .where({ 'c.wholesaler_org_id': orgId, 'c.deleted_at': null })
      .orderByRaw('last_message_at DESC NULLS LAST, c.created_at DESC');
    return rows as ConversationWithMeta[];
  }

  /* ── Messages ─────────────────────────────────────── */

  async createMessage(data: CreateMessageData): Promise<MessageRow> {
    const [row] = await this.db('messages').insert(data).returning(MSG_COLUMNS);
    return row as MessageRow;
  }

  async findMessages(convId: string, page: number, limit: number): Promise<PaginatedMessages> {
    const offset = (page - 1) * limit;

    const [{ count }] = await this.db('messages')
      .count('id as count')
      .where({ conversation_id: convId, deleted_at: null }) as [{ count: string }];

    const data = await this.db('messages')
      .select(MSG_COLUMNS)
      .where({ conversation_id: convId, deleted_at: null })
      .orderBy('created_at', 'asc')
      .limit(limit)
      .offset(offset) as MessageRow[];

    return { data, total: Number(count), page, limit };
  }

  async markRead(convId: string, readerUserId: string): Promise<void> {
    await this.db('messages')
      .where({ conversation_id: convId, deleted_at: null, read_at: null })
      .whereNot('sender_user_id', readerUserId)
      .update({ read_at: this.db.fn.now() });
  }

  /* ── Available orgs (for buyer discovery) ─────────── */

  async findActiveWholesalerOrgs(): Promise<Array<{ id: string; name: string }>> {
    return this.db('organizations')
      .select('id', 'name')
      .where({ type: 'wholesaler', status: 'active', deleted_at: null })
      .orderBy('name') as Promise<Array<{ id: string; name: string }>>;
  }
}
