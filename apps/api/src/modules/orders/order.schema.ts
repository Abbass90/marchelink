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

/** §5 — Mode de livraison choisi par le grossiste après acceptation. */
export const SetDeliveryModeSchema = z.object({
  delivery_mode: z.enum(['wholesaler', 'swiftgo'], {
    errorMap: () => ({ message: "Mode invalide — valeurs acceptées : 'wholesaler', 'swiftgo'" }),
  }),
});

export type PlaceOrderDto = z.infer<typeof PlaceOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
export type SetDeliveryModeDto = z.infer<typeof SetDeliveryModeSchema>;
