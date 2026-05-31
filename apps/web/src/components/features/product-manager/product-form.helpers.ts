import type {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
} from '../../../api/client.js';

/* ── Types ───────────────────────────────────────────── */

export interface FormErrors {
  sku?: string | undefined;
  name?: string | undefined;
  price_xof?: string | undefined;
  stock_qty?: string | undefined;
  unit?: string | undefined;
  image_url?: string | undefined;
}

export interface FormValues {
  sku: string;
  name: string;
  description: string;
  price_xof: string;
  stock_qty: string;
  unit: string;
  category: string;
  image_url: string;
}

export const EMPTY_FORM: FormValues = {
  sku: '',
  name: '',
  description: '',
  price_xof: '',
  stock_qty: '',
  unit: 'unité',
  category: 'autre',
  image_url: '',
};

/* ── Formatage ───────────────────────────────────────── */

export function formatXOF(amount: string | number): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

/* ── Validation ──────────────────────────────────────── */

export function validateField(field: keyof FormValues, value: string): string | undefined {
  switch (field) {
    case 'sku':
      if (!value.trim()) return 'Le SKU est requis';
      if (value.length > 50) return 'SKU trop long (max 50)';
      return undefined;
    case 'name':
      if (!value.trim()) return 'Le nom est requis';
      if (value.length > 255) return 'Nom trop long (max 255)';
      return undefined;
    case 'price_xof': {
      const n = Number(value);
      if (!value.trim() || isNaN(n)) return 'Le prix est requis';
      if (!Number.isInteger(n) || n <= 0) return 'Prix entier positif requis';
      return undefined;
    }
    case 'stock_qty': {
      const n = Number(value);
      if (value.trim() === '' || isNaN(n)) return 'Le stock est requis';
      if (!Number.isInteger(n) || n < 0) return 'Stock entier positif requis';
      return undefined;
    }
    case 'unit':
      if (!value.trim()) return 'L\'unité est requise';
      return undefined;
    case 'image_url':
      if (value.trim() && !/^https?:\/\//.test(value)) return 'URL invalide';
      return undefined;
    default:
      return undefined;
  }
}

export function validateAll(form: FormValues): FormErrors {
  const errs: FormErrors = {};
  const fields: Array<keyof FormValues> = ['sku', 'name', 'price_xof', 'stock_qty', 'unit', 'image_url'];
  for (const f of fields) {
    const e = validateField(f, form[f]);
    if (e) (errs as Record<string, string>)[f] = e;
  }
  return errs;
}

/* ── Mapping produit ↔ formulaire ────────────────────── */

export function productToForm(product: Product): FormValues {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? '',
    price_xof: String(product.price_xof),
    stock_qty: String(product.stock_qty),
    unit: product.unit,
    category: product.category ?? 'autre',
    image_url: product.image_url ?? '',
  };
}

export function buildCreatePayload(form: FormValues): CreateProductPayload {
  return {
    sku: form.sku,
    name: form.name,
    description: form.description || undefined,
    price_xof: Number(form.price_xof),
    stock_qty: Number(form.stock_qty),
    unit: form.unit,
    category: form.category,
    image_url: form.image_url || undefined,
  };
}

export function buildUpdatePayload(form: FormValues): UpdateProductPayload {
  return {
    name: form.name,
    description: form.description || undefined,
    price_xof: Number(form.price_xof),
    stock_qty: Number(form.stock_qty),
    unit: form.unit,
    category: form.category,
    image_url: form.image_url || undefined,
  };
}
