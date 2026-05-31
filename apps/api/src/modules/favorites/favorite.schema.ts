import { z } from 'zod';

export const ProductIdParamSchema = z.object({
  productId: z.string().uuid('productId must be a valid UUID'),
});
export type ProductIdParam = z.infer<typeof ProductIdParamSchema>;
