import type { Knex } from 'knex';
import { ChatRepository } from './chat.repository.js';
import type { ConversationRow, ConversationWithMeta, MessageRow, PaginatedMessages } from './chat.repository.js';
import { NotFoundError } from '../../errors/index.js';

export class ChatService {
  constructor(private repo: ChatRepository, private db: Knex) {}

  /* ── Conversations ────────────────────────────────── */

  async createOrGetConversation(buyerUserId: string, wholesalerOrgId: string): Promise<ConversationRow> {
    // CLAUDE.md §14 : vérifier que l'org existe avant de créer (sinon 404)
    const org = await this.db('organizations')
      .where({ id: wholesalerOrgId, type: 'wholesaler', status: 'active', deleted_at: null })
      .first();
    if (!org) throw new NotFoundError('Organisation grossiste introuvable');
    return this.repo.findOrCreate(buyerUserId, wholesalerOrgId);
  }

  async listInboxBuyer(buyerUserId: string): Promise<ConversationWithMeta[]> {
    return this.repo.findByBuyer(buyerUserId);
  }

  async listInboxOrg(orgId: string): Promise<ConversationWithMeta[]> {
    return this.repo.findByOrg(orgId);
  }

  async listOrgs(): Promise<Array<{ id: string; name: string }>> {
    return this.repo.findActiveWholesalerOrgs();
  }

  /* ── Messages ─────────────────────────────────────── */

  async sendMessageAsBuyer(convId: string, buyerUserId: string, body: string): Promise<MessageRow> {
    const conv = await this.repo.findByIdForBuyer(convId, buyerUserId);
    if (!conv) throw new NotFoundError('Conversation introuvable');
    return this.repo.createMessage({ conversation_id: convId, sender_user_id: buyerUserId, body, created_by: buyerUserId });
  }

  async sendMessageAsOrg(convId: string, orgId: string, senderUserId: string, body: string): Promise<MessageRow> {
    const conv = await this.repo.findByIdForOrg(convId, orgId);
    if (!conv) throw new NotFoundError('Conversation introuvable');
    return this.repo.createMessage({ conversation_id: convId, sender_user_id: senderUserId, body, created_by: senderUserId });
  }

  async getMessagesBuyer(convId: string, buyerUserId: string, page: number, limit: number): Promise<PaginatedMessages> {
    const conv = await this.repo.findByIdForBuyer(convId, buyerUserId);
    if (!conv) throw new NotFoundError('Conversation introuvable');
    return this.repo.findMessages(convId, page, limit);
  }

  async getMessagesOrg(convId: string, orgId: string, page: number, limit: number): Promise<PaginatedMessages> {
    const conv = await this.repo.findByIdForOrg(convId, orgId);
    if (!conv) throw new NotFoundError('Conversation introuvable');
    return this.repo.findMessages(convId, page, limit);
  }

  async markReadBuyer(convId: string, buyerUserId: string): Promise<void> {
    const conv = await this.repo.findByIdForBuyer(convId, buyerUserId);
    if (!conv) throw new NotFoundError('Conversation introuvable');
    await this.repo.markRead(convId, buyerUserId);
  }

  async markReadOrg(convId: string, orgId: string, userId: string): Promise<void> {
    const conv = await this.repo.findByIdForOrg(convId, orgId);
    if (!conv) throw new NotFoundError('Conversation introuvable');
    await this.repo.markRead(convId, userId);
  }
}
