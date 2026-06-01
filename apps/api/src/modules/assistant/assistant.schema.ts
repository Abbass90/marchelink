import { z } from 'zod';

/* ── Historique de conversation (passé par le frontend) ──── */

export const AssistantTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

/* ── Payload du endpoint POST /api/assistant/chat ────────── */

export const AssistantMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(AssistantTurnSchema).max(20).optional().default([]),
});

/* ── Arguments des outils de commande (fournis par l'IA) ───
 * Validés AVANT tout appel à OrderService : l'IA ne peut pas injecter un
 * identifiant mal formé, une quantité nulle/négative ou une commande géante. */

export const AssistantOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive().max(100000),
});

export const AssistantOrderToolSchema = z.object({
  grossiste_id: z.string().uuid(),
  items: z.array(AssistantOrderItemSchema).min(1).max(50),
});

export type AssistantTurn = z.infer<typeof AssistantTurnSchema>;
export type AssistantMessageDto = z.infer<typeof AssistantMessageSchema>;
export type AssistantOrderToolDto = z.infer<typeof AssistantOrderToolSchema>;
