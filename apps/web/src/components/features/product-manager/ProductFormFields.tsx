import { PRODUCT_CATEGORIES, CATEGORY_LABELS } from '../../../constants/categories.js';
import ProductImageUpload from '../ProductImageUpload.js';
import PmField from './PmField.js';
import type { FormValues, FormErrors } from './product-form.helpers.js';

interface ProductFormFieldsProps {
  form: FormValues;
  errors: FormErrors;
  disableSku: boolean;
  onChange: (field: keyof FormValues, value: string) => void;
  onBlur: (field: keyof FormValues) => void;
}

/** Corps du formulaire produit : les 8 champs (hors logique de soumission). */
export default function ProductFormFields({
  form, errors, disableSku, onChange, onBlur,
}: ProductFormFieldsProps) {
  return (
    <>
      <PmField
        id="pm-sku"
        label="SKU"
        testId="pm-field-sku"
        value={form.sku}
        disabled={disableSku}
        onChange={(v) => onChange('sku', v)}
        onBlur={() => onBlur('sku')}
        error={errors.sku}
        errorTestId="pm-error-sku"
        placeholder="EX: RIZ-50KG"
      />

      <PmField
        id="pm-name"
        label="Nom du produit"
        testId="pm-field-name"
        value={form.name}
        onChange={(v) => onChange('name', v)}
        onBlur={() => onBlur('name')}
        error={errors.name}
        errorTestId="pm-error-name"
        placeholder="Riz parfumé 50 kg"
      />

      <div className="pm-field">
        <label className="pm-label" htmlFor="pm-desc">Description (optionnel)</label>
        <textarea
          id="pm-desc"
          className="pm-input pm-textarea"
          data-testid="pm-field-description"
          value={form.description}
          onChange={(e) => onChange('description', e.target.value)}
          rows={3}
          placeholder="Détails du produit…"
        />
      </div>

      <div className="pm-field">
        <label className="pm-label" htmlFor="pm-category">Catégorie</label>
        <select
          id="pm-category"
          className="pm-input"
          data-testid="pm-field-category"
          value={form.category}
          onChange={(e) => onChange('category', e.target.value)}
        >
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      <div className="pm-field-row">
        <PmField
          id="pm-price"
          label="Prix (XOF)"
          testId="pm-field-price"
          type="number"
          value={form.price_xof}
          onChange={(v) => onChange('price_xof', v)}
          onBlur={() => onBlur('price_xof')}
          error={errors.price_xof}
          errorTestId="pm-error-price"
          min={1}
          step={1}
          placeholder="15000"
        />
        <PmField
          id="pm-stock"
          label="Stock"
          testId="pm-field-stock"
          type="number"
          value={form.stock_qty}
          onChange={(v) => onChange('stock_qty', v)}
          onBlur={() => onBlur('stock_qty')}
          error={errors.stock_qty}
          errorTestId="pm-error-stock"
          min={0}
          step={1}
          placeholder="200"
        />
      </div>

      <PmField
        id="pm-unit"
        label="Unité"
        testId="pm-field-unit"
        value={form.unit}
        onChange={(v) => onChange('unit', v)}
        onBlur={() => onBlur('unit')}
        error={errors.unit}
        errorTestId="pm-error-unit"
        placeholder="kg"
      />

      <div className="pm-field">
        <label className="pm-label">Photo du produit (optionnel)</label>
        <ProductImageUpload
          value={form.image_url}
          onChange={(url) => onChange('image_url', url)}
        />
      </div>
    </>
  );
}
