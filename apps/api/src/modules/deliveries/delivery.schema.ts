import { z } from 'zod';

export const AssignDeliverySchema = z.object({
  order_id: z.string().uuid(),
  assigned_to_user_id: z.string().uuid(),
});

export type AssignDeliveryDto = z.infer<typeof AssignDeliverySchema>;
