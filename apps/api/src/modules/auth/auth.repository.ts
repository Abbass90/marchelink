import type { Knex } from 'knex';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  organization_id: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

export class AuthRepository {
  constructor(private readonly db: Knex) {}

  async findByEmail(email: string): Promise<UserRow | undefined> {
    return this.db('users')
      .select('id', 'email', 'password_hash', 'role', 'organization_id', 'phone', 'first_name', 'last_name', 'created_at', 'updated_at', 'deleted_at')
      .where({ email })
      .whereNull('deleted_at')
      .first();
  }

  async findById(id: string): Promise<UserRow | undefined> {
    return this.db('users')
      .select('id', 'email', 'password_hash', 'role', 'organization_id', 'phone', 'first_name', 'last_name', 'created_at', 'updated_at', 'deleted_at')
      .where({ id })
      .whereNull('deleted_at')
      .first();
  }

  async createUser(data: {
    email: string;
    password_hash: string;
    role: string;
    first_name: string;
    last_name: string;
    phone?: string;
    organization_id?: string | null;
  }): Promise<UserRow> {
    const [user] = await this.db('users')
      .insert({
        email: data.email,
        password_hash: data.password_hash,
        role: data.role,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone ?? null,
        organization_id: data.organization_id ?? null,
      })
      .returning(['id', 'email', 'role', 'organization_id', 'phone', 'first_name', 'last_name', 'created_at', 'updated_at', 'deleted_at']);
    return user as UserRow;
  }

  async saveRefreshToken(data: {
    user_id: string;
    token_hash: string;
    expires_at: Date;
  }): Promise<void> {
    await this.db('refresh_tokens').insert(data);
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | undefined> {
    return this.db('refresh_tokens')
      .select('id', 'user_id', 'token_hash', 'expires_at', 'revoked', 'created_at')
      .where({ token_hash: tokenHash, revoked: false })
      .first();
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db('refresh_tokens')
      .where({ token_hash: tokenHash })
      .update({ revoked: true });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db('refresh_tokens')
      .where({ user_id: userId, revoked: false })
      .update({ revoked: true });
  }

  async updateUser(
    id: string,
    data: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string | null;
      password_hash?: string;
    },
  ): Promise<UserRow> {
    const [user] = await this.db('users')
      .where({ id })
      .whereNull('deleted_at')
      .update({ ...data, updated_at: new Date() })
      .returning([
        'id', 'email', 'password_hash', 'role', 'organization_id',
        'phone', 'first_name', 'last_name', 'created_at', 'updated_at', 'deleted_at',
      ]);
    return user as UserRow;
  }

  async createOrganization(
    name: string,
    createdBy?: string,
    trx?: import('knex').Knex.Transaction,
  ): Promise<{ id: string; name: string; type: string; status: string }> {
    const conn = trx ?? this.db;
    const [org] = await conn('organizations')
      .insert({
        name,
        type: 'wholesaler',
        status: 'active',
        created_by: createdBy ?? null,
        updated_by: createdBy ?? null,
      })
      .returning(['id', 'name', 'type', 'status']);
    return org as { id: string; name: string; type: string; status: string };
  }

  async createUserInTrx(
    data: {
      email: string;
      password_hash: string;
      role: string;
      first_name: string;
      last_name: string;
      phone?: string;
      organization_id: string;
    },
    trx: import('knex').Knex.Transaction,
  ): Promise<UserRow> {
    const [user] = await trx('users')
      .insert({
        email: data.email,
        password_hash: data.password_hash,
        role: data.role,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone ?? null,
        organization_id: data.organization_id,
      })
      .returning(['id', 'email', 'role', 'organization_id', 'phone', 'first_name', 'last_name', 'created_at', 'updated_at', 'deleted_at']);
    return user as UserRow;
  }
}
