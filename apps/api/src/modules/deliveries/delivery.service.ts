import { DeliveryRepository } from './delivery.repository.js';
import { OrderEventRepository } from '../orders/order-event.repository.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import type { AssignDeliveryDto } from './delivery.schema.js';

export class DeliveryService {
  constructor(
    private repo: DeliveryRepository,
    private eventRepo?: OrderEventRepository,
  ) {}

  async assignDelivery(dto: AssignDeliveryDto, orgId: string, createdBy: string) {
    const order = await this.repo.getOrderForOrg(dto.order_id, orgId);
    if (!order) throw new NotFoundError('Order not found');

    if (order.status !== 'paid') {
      throw new ValidationError(`Cannot assign delivery on order with status '${order.status}'`);
    }

    const operator = await this.repo.getOperatorInOrg(dto.assigned_to_user_id, orgId);
    if (!operator) throw new ValidationError('Delivery operator not found in this organization');

    const existing = await this.repo.findByOrderId(dto.order_id);
    if (existing) throw new ValidationError('Delivery already assigned for this order');

    const delivery = await this.repo.create({
      order_id: dto.order_id,
      wholesaler_org_id: orgId,
      assigned_to_user_id: dto.assigned_to_user_id,
      created_by: createdBy,
    });

    await this.repo.updateOrderDeliveryId(dto.order_id, delivery.id);
    return delivery;
  }

  async listByOperator(operatorUserId: string) {
    return this.repo.findAllByOperator(operatorUserId);
  }

  async listByOrg(orgId: string) {
    return this.repo.findAllByOrg(orgId);
  }

  async markDelivered(deliveryId: string, operatorUserId: string) {
    const delivery = await this.repo.findByIdForOperator(deliveryId, operatorUserId);
    if (!delivery) throw new NotFoundError('Delivery not found');

    if (delivery.status === 'delivered') {
      throw new ValidationError('Delivery already marked as delivered');
    }

    const updated = await this.repo.markDelivered(deliveryId, operatorUserId);
    await this.repo.updateOrderStatus(delivery.order_id, 'delivered');

    // Historisation du passage au statut delivered
    if (this.eventRepo) {
      await this.eventRepo.insertEvent({
        order_id: delivery.order_id,
        status: 'delivered',
        created_by: operatorUserId,
        updated_by: operatorUserId,
      });
    }

    return updated;
  }

  async getAvailableOrders(orgId: string) {
    return this.repo.findAvailableForOrg(orgId);
  }

  async selfAssign(orderId: string, operatorUserId: string, orgId: string) {
    const order = await this.repo.getOrderForOrg(orderId, orgId);
    if (!order) throw new NotFoundError('Order not found');

    if (order.status !== 'paid') {
      throw new ValidationError(`Cannot assign delivery on order with status '${order.status}'`);
    }

    const existing = await this.repo.findByOrderId(orderId);
    if (existing) throw new ValidationError('Delivery already assigned for this order');

    const delivery = await this.repo.create({
      order_id: orderId,
      wholesaler_org_id: orgId,
      assigned_to_user_id: operatorUserId,
      created_by: operatorUserId,
    });

    await this.repo.updateOrderDeliveryId(orderId, delivery.id);
    await this.repo.updateOrderStatus(orderId, 'shipped');

    // Historisation du passage au statut shipped
    if (this.eventRepo) {
      await this.eventRepo.insertEvent({
        order_id: orderId,
        status: 'shipped',
        created_by: operatorUserId,
        updated_by: operatorUserId,
      });
    }

    return delivery;
  }
}
