import type { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service.js';

export class DashboardController {
  constructor(private service: DashboardService) {}

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.service.getStats(req.user!.organization_id!);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  };
}
