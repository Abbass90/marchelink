import { z } from 'zod';

export const CreateConversationSchema = z.object({
  wholesaler_org_id: z.string().uuid(),
});

export const SendMessageSchema = z.object({
  body: z.string().min(1, 'Le message ne peut pas être vide').max(2000),
});

export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
