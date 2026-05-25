import type { Request, Response, NextFunction } from 'express';
import { DeliveryService } from './delivery.service.js';
import { AssignDeliverySchema } from './delivery.schema.js';

export class DeliveryController {
  constructor(private service: DeliveryService) {}

  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = AssignDeliverySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ status: 422, error: 'Validation Error', message: parsed.error.issues });
        return;
      }
      const delivery = await this.service.assignDelivery(parsed.data, req.user!.organization_id!, req.user!.id);
      res.status(201).json(delivery);
    } catch (err) {
      next(err);
    }
  };

  listByOrg = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deliveries = await this.service.listByOrg(req.user!.organization_id!);
      res.json(deliveries);
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deliveries = await this.service.listByOperator(req.user!.id);
      res.json(deliveries);
    } catch (err) {
      next(err);
    }
  };

  markDelivered = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const delivery = await this.service.markDelivered(req.params.id!, req.user!.id);
      res.json(delivery);
    } catch (err) {
      next(err);
    }
  };

  listAvailable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await this.service.getAvailableOrders(req.user!.organization_id!);
      res.json(orders);
    } catch (err) {
      next(err);
    }
  };

  acceptOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const delivery = await this.service.selfAssign(
        req.params.orderId!,
        req.user!.id,
        req.user!.organization_id!,
      );
      res.status(201).json(delivery);
    } catch (err) {
      next(err);
    }
  };
}
