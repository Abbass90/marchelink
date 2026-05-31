// Vocabulaire des catégories produit affiché côté web.
// ⚠️ Tenu en phase avec PRODUCT_CATEGORIES de apps/api/src/modules/products/product.schema.ts
//    (source de vérité validée par Zod côté API).

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

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  tissus: 'Tissus',
  epices: 'Épices',
  alimentaire: 'Alimentaire',
  cosmetiques: 'Cosmétiques',
  maison: 'Maison',
  electronique: 'Électronique',
  mode: 'Mode & Vêtements',
  autre: 'Autre',
};

/** Libellé lisible d'une catégorie, avec repli sûr si la valeur est inconnue. */
export function categoryLabel(value: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[value] ?? 'Autre';
}
