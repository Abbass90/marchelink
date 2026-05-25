import { z } from 'zod';

export const InitiatePaymentSchema = z.object({
  order_id: z.string().uuid(),
  phone_number: z.string().min(8).max(20),
});

export const WebhookPayloadSchema = z.object({
  idempotency_key: z.string().min(1).max(255),
  provider_ref: z.string().min(1),
  status: z.enum(['completed', 'failed']),
});

export type InitiatePaymentDto = z.infer<typeof InitiatePaymentSchema>;
export type WebhookPayloadDto = z.infer<typeof WebhookPayloadSchema>;
