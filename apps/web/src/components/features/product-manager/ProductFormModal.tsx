import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Product } from '../../../api/client.js';
import ProductFormFields from './ProductFormFields.js';
import {
  EMPTY_FORM,
  validateField,
  validateAll,
  productToForm,
  type FormValues,
  type FormErrors,
} from './product-form.helpers.js';

interface ProductFormModalProps {
  editingProduct: Product | null;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
}

export default function ProductFormModal({ editingProduct, onClose, onSubmit }: ProductFormModalProps) {
  const [form, setForm] = useState<FormValues>(() =>
    editingProduct ? productToForm(editingProduct) : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function handleChange(field: keyof FormValues, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
  }

  function handleBlur(field: keyof FormValues) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const allErrors = validateAll(form);
    setErrors(allErrors);
    setTouched({ sku: true, name: true, price_xof: true, stock_qty: true, unit: true, image_url: true });
    if (Object.values(allErrors).some(Boolean)) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(form);
      // Succès : le parent ferme la modale (démontage de ce composant).
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inconnue');
      setSubmitting(false);
    }
  }

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div
      className="pm-modal-overlay"
      data-testid="pm-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pm-modal-card">
        <h2 className="pm-modal-title" data-testid="pm-modal-title">
          {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
        </h2>

        {submitError && (
          <div className="ws-error-banner" data-testid="pm-submit-error">
            {submitError}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <ProductFormFields
            form={form}
            errors={errors}
            disableSku={!!editingProduct}
            onChange={handleChange}
            onBlur={handleBlur}
          />

          <div className="pm-modal-actions">
            <button
              type="button"
              className="ws-btn ws-btn--secondary"
              data-testid="pm-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="ws-btn ws-btn--primary"
              data-testid="pm-submit-btn"
              disabled={submitting || hasErrors}
            >
              {submitting
                ? 'Enregistrement…'
                : editingProduct
                  ? 'Mettre à jour'
                  : 'Créer le produit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
