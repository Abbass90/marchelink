import { z } from 'zod';

const OrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const PlaceOrderSchema = z.object({
  wholesaler_org_id: z.string().uuid(),
  items: z.array(OrderItemSchema).min(1),
});

export const UpdateOrderStatusSchema = z.object({
  // Le grossiste pilote tout le cycle aval : pending→accepted/rejected, puis
  // paid→shipped (expédiée) →delivered (livrée). Plus de livreur séparé.
  status: z.enum(['accepted', 'rejected', 'shipped', 'delivered']),
});

export type PlaceOrderDto = z.infer<typeof PlaceOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
