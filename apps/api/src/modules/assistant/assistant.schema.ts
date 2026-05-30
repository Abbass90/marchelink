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

export type AssistantTurn = z.infer<typeof AssistantTurnSchema>;
export type AssistantMessageDto = z.infer<typeof AssistantMessageSchema>;
