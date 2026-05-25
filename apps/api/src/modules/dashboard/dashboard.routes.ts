import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardRepository } from './dashboard.repository.js';
import { db } from '../../db/knex.js';

const dashboardRepo = new DashboardRepository(db);
const dashboardService = new DashboardService(dashboardRepo);
const dashboardController = new DashboardController(dashboardService);

export const dashboardRouter = Router();

dashboardRouter.get('/', requireAuth, requireRole('wholesaler_admin'), dashboardController.getStats);
