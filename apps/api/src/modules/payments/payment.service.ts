import { PaymentRepository } from './payment.repository.js';
import { OrderEventRepository } from '../orders/order-event.repository.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import type { InitiatePaymentDto, WebhookPayloadDto } from './payment.schema.js';
import { randomUUID } from 'node:crypto';

export class PaymentService {
  constructor(
    private repo: PaymentRepository,
    private eventRepo?: OrderEventRepository,
  ) {}

  async initiatePayment(dto: InitiatePaymentDto, buyerUserId: string) {
    const order = await this.repo.getOrderById(dto.order_id, buyerUserId);
    if (!order) throw new NotFoundError('Order not found');

    if (order.status !== 'accepted') {
      throw new ValidationError(`Cannot initiate payment on order with status '${order.status}'`);
    }

    const existing = await this.repo.findByOrderId(dto.order_id);
    if (existing && existing.status === 'pending') {
      return existing;
    }
    if (existing && existing.status === 'completed') {
      throw new ValidationError('Payment already completed for this order');
    }

    const idempotencyKey = `pay_${randomUUID()}`;

    const payment = await this.repo.create({
      order_id: dto.order_id,
      wholesaler_org_id: order.wholesaler_org_id,
      amount_xof: Number(order.total_xof),
      idempotency_key: idempotencyKey,
      created_by: buyerUserId,
    });

    return payment;
  }

  async processWebhook(dto: WebhookPayloadDto) {
    const payment = await this.repo.findByIdempotencyKey(dto.idempotency_key);
    if (!payment) throw new NotFoundError('Payment not found');

    if (payment.status === 'completed' || payment.status === 'failed') {
      return { already_processed: true, payment };
    }

    const updated = await this.repo.updateStatus(payment.id, dto.status, dto.provider_ref);

    if (dto.status === 'completed') {
      await this.repo.updateOrderStatus(payment.order_id, 'paid');
      // Historisation du passage au statut paid (acteur système = null)
      if (this.eventRepo) {
        await this.eventRepo.insertEvent({
          order_id: payment.order_id,
          status: 'paid',
          notes: `Payment confirmed — ref: ${dto.provider_ref ?? 'N/A'}`,
          created_by: null,
          updated_by: null,
        });
      }
    }

    return { already_processed: false, payment: updated };
  }

  async listByBuyer(buyerUserId: string) {
    return this.repo.findByBuyerId(buyerUserId);
  }

  async listByOrg(orgId: string) {
    return this.repo.findByOrgId(orgId);
  }
}
