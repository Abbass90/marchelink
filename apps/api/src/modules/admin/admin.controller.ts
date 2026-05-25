import type { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service.js';

export class AdminController {
  constructor(private service: AdminService) {}

  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.service.getStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  };

  listUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.service.listUsers();
      res.json(users);
    } catch (err) {
      next(err);
    }
  };

  listOrganizations = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgs = await this.service.listOrganizations();
      res.json(orgs);
    } catch (err) {
      next(err);
    }
  };

  listOrders = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await this.service.listOrders();
      res.json(orders);
    } catch (err) {
      next(err);
    }
  };
}
