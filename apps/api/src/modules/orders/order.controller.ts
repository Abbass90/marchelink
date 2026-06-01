import type { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service.js';
import { PlaceOrderSchema, UpdateOrderStatusSchema } from './order.schema.js';
import { ValidationError } from '../../errors/index.js';

export class OrderController {
  constructor(private service: OrderService) {}

  placeOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = PlaceOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ status: 422, error: 'Validation Error', message: parsed.error.issues });
        return;
      }
      const order = await this.service.placeOrder(parsed.data, req.user!.id);
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  };

  listByBuyer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await this.service.listByBuyer(req.user!.id);
      res.json(orders);
    } catch (err) {
      next(err);
    }
  };

  listByOrg = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await this.service.listByOrg(req.user!.organization_id!);
      res.json(orders);
    } catch (err) {
      next(err);
    }
  };

  getByIdForBuyer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.service.getByIdForBuyer(req.params.id!, req.user!.id);
      res.json(order);
    } catch (err) {
      next(err);
    }
  };

  getByIdForWholesaler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.service.getByIdForWholesaler(req.params.id!, req.user!.organization_id!);
      res.json(order);
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = UpdateOrderStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ status: 422, error: 'Validation Error', message: parsed.error.issues });
        return;
      }
      const { status } = parsed.data;
      const orderId = req.params.id!;
      const orgId = req.user!.organization_id!;
      const actorId = req.user!.id;
      let order;
      switch (status) {
        case 'accepted':
          order = await this.service.acceptOrder(orderId, orgId, actorId);
          break;
        case 'rejected':
          order = await this.service.rejectOrder(orderId, orgId, actorId);
          break;
        case 'shipped':
          order = await this.service.shipOrder(orderId, orgId, actorId);
          break;
        case 'delivered':
          order = await this.service.deliverOrder(orderId, orgId, actorId);
          break;
      }
      res.json(order);
    } catch (err) {
      next(err);
    }
  };

  cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.service.cancelOrder(req.params.id!, req.user!.id);
      res.json(order);
    } catch (err) {
      next(err);
    }
  };

  getTimelineForBuyer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const events = await this.service.getTimelineForBuyer(req.params.id!, req.user!.id);
      res.json(events);
    } catch (err) {
      next(err);
    }
  };

  getTimelineForWholesaler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const events = await this.service.getTimelineForWholesaler(req.params.id!, req.user!.organization_id!);
      res.json(events);
    } catch (err) {
      next(err);
    }
  };
}
