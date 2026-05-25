import { AdminRepository } from './admin.repository.js';

export class AdminService {
  constructor(private repo: AdminRepository) {}

  async getStats() {
    return this.repo.getStats();
  }

  async listUsers() {
    return this.repo.listUsers();
  }

  async listOrganizations() {
    return this.repo.listOrganizations();
  }

  async listOrders() {
    return this.repo.listOrders();
  }
}
