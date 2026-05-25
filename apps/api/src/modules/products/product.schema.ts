import { z } from 'zod';

export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  price_xof: z.number().int().positive(),
  stock_qty: z.number().int().min(0),
  unit: z.string().min(1).max(50).default('unité'),
  image_url: z.string().url().max(500).optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  price_xof: z.number().int().positive().optional(),
  stock_qty: z.number().int().min(0).optional(),
  unit: z.string().min(1).max(50).optional(),
  image_url: z.string().url().max(500).nullable().optional(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
