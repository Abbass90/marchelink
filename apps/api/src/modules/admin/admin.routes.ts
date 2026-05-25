import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminRepository } from './admin.repository.js';
import { db } from '../../db/knex.js';

const adminRepo = new AdminRepository(db);
const adminService = new AdminService(adminRepo);
const adminController = new AdminController(adminService);

export const adminRouter = Router();

adminRouter.get('/stats', requireAuth, requireRole('platform_admin'), adminController.getStats);
adminRouter.get('/users', requireAuth, requireRole('platform_admin'), adminController.listUsers);
adminRouter.get('/organizations', requireAuth, requireRole('platform_admin'), adminController.listOrganizations);
adminRouter.get('/orders', requireAuth, requireRole('platform_admin'), adminController.listOrders);
