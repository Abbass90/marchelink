import type { Request, Response, NextFunction } from 'express';
import { ChatService } from './chat.service.js';
import { CreateConversationSchema, SendMessageSchema } from './chat.schema.js';

const PAGE_SIZE = 20;

export class ChatController {
  constructor(private service: ChatService) {}

  /* GET /api/chat/orgs — liste les grossistes disponibles (buyer discovery) */
  listOrgs = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgs = await this.service.listOrgs();
      res.json(orgs);
    } catch (err) { next(err); }
  };

  /* POST /api/chat/conversations — buyer crée ou récupère une conversation */
  createConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ status: 422, error: 'Validation Error', message: parsed.error.issues });
        return;
      }
      const conv = await this.service.createOrGetConversation(req.user!.id, parsed.data.wholesaler_org_id);
      res.status(201).json(conv);
    } catch (err) { next(err); }
  };

  /* GET /api/chat/conversations — inbox de l'utilisateur connecté */
  listConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const convs = user.role === 'buyer'
        ? await this.service.listInboxBuyer(user.id)
        : await this.service.listInboxOrg(user.organization_id!);
      res.json(convs);
    } catch (err) { next(err); }
  };

  /* GET /api/chat/conversations/:id/messages */
  getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const convId = req.params['id']!;
      const page = Math.max(1, Number(req.query['page']) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query['limit']) || PAGE_SIZE));

      const result = user.role === 'buyer'
        ? await this.service.getMessagesBuyer(convId, user.id, page, limit)
        : await this.service.getMessagesOrg(convId, user.organization_id!, page, limit);
      res.json(result);
    } catch (err) { next(err); }
  };

  /* POST /api/chat/conversations/:id/messages — envoyer un message */
  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = SendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ status: 422, error: 'Validation Error', message: parsed.error.issues });
        return;
      }
      const user = req.user!;
      const convId = req.params['id']!;
      const msg = user.role === 'buyer'
        ? await this.service.sendMessageAsBuyer(convId, user.id, parsed.data.body)
        : await this.service.sendMessageAsOrg(convId, user.organization_id!, user.id, parsed.data.body);
      res.status(201).json(msg);
    } catch (err) { next(err); }
  };

  /* PATCH /api/chat/conversations/:id/read — marquer les messages comme lus */
  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const convId = req.params['id']!;
      if (user.role === 'buyer') {
        await this.service.markReadBuyer(convId, user.id);
      } else {
        await this.service.markReadOrg(convId, user.organization_id!, user.id);
      }
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
