import { z } from 'zod';

// Vocabulaire contrôlé des catégories produit (marché d'Adjamé).
// Tenu à jour en parallèle de apps/web/src/constants/categories.ts.
export const PRODUCT_CATEGORIES = [
  'tissus',
  'epices',
  'alimentaire',
  'cosmetiques',
  'maison',
  'electronique',
  'mode',
  'autre',
] as const;

export const ProductCategorySchema = z.enum(PRODUCT_CATEGORIES);
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  price_xof: z.number().int().positive(),
  stock_qty: z.number().int().min(0),
  unit: z.string().min(1).max(50).default('unité'),
  category: ProductCategorySchema.default('autre'),
  image_url: z.string().url().max(500).optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  price_xof: z.number().int().positive().optional(),
  stock_qty: z.number().int().min(0).optional(),
  unit: z.string().min(1).max(50).optional(),
  category: ProductCategorySchema.optional(),
  image_url: z.string().url().max(500).nullable().optional(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
