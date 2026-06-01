import type { Knex } from 'knex';
import { OrderRepository } from './order.repository.js';
import { OrderEventRepository } from './order-event.repository.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import type { PlaceOrderDto } from './order.schema.js';

export class OrderService {
  constructor(
    private repo: OrderRepository,
    private db: Knex,
    private eventRepo?: OrderEventRepository,
  ) {}

  async placeOrder(dto: PlaceOrderDto, buyerUserId: string) {
    const { wholesaler_org_id, items } = dto;
    const productIds = items.map((i) => i.product_id);

    const products = await this.repo.getProductsByIds(productIds, wholesaler_org_id);

    if (products.length !== productIds.length) {
      throw new ValidationError('One or more products not found in this wholesaler catalog');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalXof = 0;
    const orderItems: Array<{ product_id: string; quantity: number; unit_price_xof: number; line_total_xof: number }> = [];

    for (const item of items) {
      const product = productMap.get(item.product_id)!;
      if (product.stock_qty < item.quantity) {
        throw new ValidationError(`Insufficient stock for product ${item.product_id}`);
      }
      const unitPrice = Number(product.price_xof);
      const lineTotal = unitPrice * item.quantity;
      totalXof += lineTotal;
      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_xof: unitPrice,
        line_total_xof: lineTotal,
      });
    }

    const trx = await this.db.transaction();
    try {
      for (const item of orderItems) {
        const updated = await this.repo.decrementStock(item.product_id, item.quantity, trx);
        if (updated === 0) {
          throw new ValidationError(`Insufficient stock for product ${item.product_id}`);
        }
      }

      const order = await this.repo.createOrder(
        { wholesaler_org_id, buyer_user_id: buyerUserId, total_xof: totalXof, created_by: buyerUserId },
        trx,
      );

      await this.repo.createOrderItems(
        orderItems.map((oi) => ({ ...oi, order_id: order.id, created_by: buyerUserId })),
        trx,
      );

      // Historisation du statut initial — atomique avec la création de commande
      if (this.eventRepo) {
        await this.eventRepo.insertEvent(
          { order_id: order.id, status: 'pending', created_by: buyerUserId, updated_by: buyerUserId },
          trx,
        );
      }

      await trx.commit();

      const orderWithItems = await this.repo.findItemsByOrderId(order.id);
      return { ...order, items: orderWithItems };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  /**
   * Devis en LECTURE SEULE : valide que les produits appartiennent bien au
   * grossiste, calcule le total et l'état du stock, SANS rien écrire. Sert au
   * récapitulatif que l'assistant présente avant confirmation (preparer_commande).
   */
  async quoteOrder(dto: PlaceOrderDto) {
    const { wholesaler_org_id, items } = dto;
    const productIds = items.map((i) => i.product_id);

    const products = await this.repo.getProductsByIds(productIds, wholesaler_org_id);
    if (products.length !== productIds.length) {
      throw new ValidationError('One or more products not found in this wholesaler catalog');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalXof = 0;
    const lignes = items.map((item) => {
      const product = productMap.get(item.product_id)!;
      const unitPrice = Number(product.price_xof);
      const lineTotal = unitPrice * item.quantity;
      totalXof += lineTotal;
      return {
        product_id: item.product_id,
        nom: product.name,
        unite: product.unit,
        quantite: item.quantity,
        prix_unitaire_xof: unitPrice,
        total_ligne_xof: lineTotal,
        en_stock: product.stock_qty >= item.quantity,
        stock_disponible: product.stock_qty,
      };
    });

    return {
      grossiste_id: wholesaler_org_id,
      lignes,
      total_xof: totalXof,
      tout_en_stock: lignes.every((l) => l.en_stock),
    };
  }

  async listByOrg(orgId: string) {
    return this.repo.findAllByOrg(orgId);
  }

  async listByBuyer(buyerUserId: string) {
    return this.repo.findAllByBuyer(buyerUserId);
  }

  async getByIdForWholesaler(orderId: string, orgId: string) {
    const order = await this.repo.findByIdForWholesaler(orderId, orgId);
    if (!order) throw new NotFoundError('Order not found');
    const items = await this.repo.findItemsByOrderId(orderId);
    return { ...order, items };
  }

  async getByIdForBuyer(orderId: string, buyerUserId: string) {
    const order = await this.repo.findByIdForBuyer(orderId, buyerUserId);
    if (!order) throw new NotFoundError('Order not found');
    const items = await this.repo.findItemsByOrderId(orderId);
    return { ...order, items };
  }

  async acceptOrder(orderId: string, orgId: string, actorUserId?: string) {
    const order = await this.repo.findByIdForWholesaler(orderId, orgId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'pending') {
      throw new ValidationError(`Cannot accept order in status '${order.status}'`);
    }
    const updated = await this.repo.updateStatus(orderId, orgId, 'accepted');
    if (this.eventRepo) {
      await this.eventRepo.insertEvent({
        order_id: orderId,
        status: 'accepted',
        created_by: actorUserId ?? null,
        updated_by: actorUserId ?? null,
      });
    }
    return updated;
  }

  async rejectOrder(orderId: string, orgId: string, actorUserId?: string) {
    const order = await this.repo.findByIdForWholesaler(orderId, orgId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'pending') {
      throw new ValidationError(`Cannot reject order in status '${order.status}'`);
    }
    const updated = await this.repo.updateStatus(orderId, orgId, 'rejected');
    if (this.eventRepo) {
      await this.eventRepo.insertEvent({
        order_id: orderId,
        status: 'rejected',
        created_by: actorUserId ?? null,
        updated_by: actorUserId ?? null,
      });
    }
    return updated;
  }

  /**
   * Le grossiste expédie une commande payée (paid → shipped). Remplace l'ancien
   * « self-assign » du livreur : c'est désormais le grossiste qui pilote la logistique.
   */
  async shipOrder(orderId: string, orgId: string, actorUserId?: string) {
    const order = await this.repo.findByIdForWholesaler(orderId, orgId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'paid') {
      throw new ValidationError(`Cannot ship order in status '${order.status}'`);
    }
    const updated = await this.repo.updateStatus(orderId, orgId, 'shipped');
    if (this.eventRepo) {
      await this.eventRepo.insertEvent({
        order_id: orderId,
        status: 'shipped',
        created_by: actorUserId ?? null,
        updated_by: actorUserId ?? null,
      });
    }
    return updated;
  }

  /**
   * Le grossiste confirme la livraison (shipped → delivered). Remplace l'ancien
   * « markDelivered » du livreur.
   */
  async deliverOrder(orderId: string, orgId: string, actorUserId?: string) {
    const order = await this.repo.findByIdForWholesaler(orderId, orgId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'shipped') {
      throw new ValidationError(`Cannot mark delivered an order in status '${order.status}'`);
    }
    const updated = await this.repo.updateStatus(orderId, orgId, 'delivered');
    if (this.eventRepo) {
      await this.eventRepo.insertEvent({
        order_id: orderId,
        status: 'delivered',
        created_by: actorUserId ?? null,
        updated_by: actorUserId ?? null,
      });
    }
    return updated;
  }

  async cancelOrder(orderId: string, buyerUserId: string) {
    const order = await this.repo.findByIdForBuyer(orderId, buyerUserId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'pending') {
      throw new ValidationError(`Cannot cancel order in status '${order.status}'`);
    }
    const updated = await this.repo.updateStatusByBuyer(orderId, buyerUserId, 'cancelled');
    if (this.eventRepo) {
      await this.eventRepo.insertEvent({
        order_id: orderId,
        status: 'cancelled',
        created_by: buyerUserId,
        updated_by: buyerUserId,
      });
    }
    return updated;
  }

  async getTimelineForBuyer(orderId: string, buyerUserId: string) {
    const order = await this.repo.findByIdForBuyer(orderId, buyerUserId);
    if (!order) throw new NotFoundError('Order not found');
    if (!this.eventRepo) return [];
    return this.eventRepo.findByOrderId(orderId);
  }

  async getTimelineForWholesaler(orderId: string, orgId: string) {
    const order = await this.repo.findByIdForWholesaler(orderId, orgId);
    if (!order) throw new NotFoundError('Order not found');
    if (!this.eventRepo) return [];
    return this.eventRepo.findByOrderId(orderId);
  }
}
