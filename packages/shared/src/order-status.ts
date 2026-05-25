import { z } from 'zod';

// State machine des commandes (cf. docs/PRD.md §5)
export const OrderStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'paid',
  'assigned',
  'delivered',
  'cancelled',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
