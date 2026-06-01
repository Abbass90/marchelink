import type { Request, Response, NextFunction } from 'express';
import { AssistantService } from './assistant.service.js';
import { AssistantMessageSchema } from './assistant.schema.js';

export class AssistantController {
  constructor(private service: AssistantService) {}

  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = AssistantMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ status: 422, error: 'Validation Error', message: parsed.error.issues });
        return;
      }
      const { message, history } = parsed.data;
      const result = await this.service.chat(message, history, req.user!.id, req.correlationId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
