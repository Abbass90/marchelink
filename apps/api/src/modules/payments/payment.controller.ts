import type { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service.js';
import { InitiatePaymentSchema, WebhookPayloadSchema } from './payment.schema.js';

export class PaymentController {
  constructor(private service: PaymentService) {}

  initiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = InitiatePaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ status: 422, error: 'Validation Error', message: parsed.error.issues });
        return;
      }
      const payment = await this.service.initiatePayment(parsed.data, req.user!.id);
      res.status(201).json(payment);
    } catch (err) {
      next(err);
    }
  };

  listByBuyer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payments = await this.service.listByBuyer(req.user!.id);
      res.json(payments);
    } catch (err) {
      next(err);
    }
  };

  listByOrg = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payments = await this.service.listByOrg(req.user!.organization_id!);
      res.json(payments);
    } catch (err) {
      next(err);
    }
  };

  webhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = WebhookPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ status: 422, error: 'Validation Error', message: parsed.error.issues });
        return;
      }
      const result = await this.service.processWebhook(parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
