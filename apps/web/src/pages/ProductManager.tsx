import { useState, useEffect, useCallback } from 'react';
import {
  fetchMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type CreateProductPayload,
  type UpdateProductPayload,
} from '../api/client.js';
import '../components/primitives/catalog.css';

function formatXOF(amount: string | number): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

type PageState = 'loading' | 'error' | 'success';

interface FormErrors {
  sku?: string | undefined;
  name?: string | undefined;
  price_xof?: string | undefined;
  stock_qty?: string | undefined;
  unit?: string | undefined;
  image_url?: string | undefined;
}

interface FormValues {
  sku: string;
  name: string;
  description: string;
  price_xof: string;
  stock_qty: string;
  unit: string;
  image_url: string;
}

const EMPTY_FORM: FormValues = {
  sku: '',
  name: '',
  description: '',
  price_xof: '',
  stock_qty: '',
  unit: 'unité',
  image_url: '',
};

function validateField(field: keyof FormValues, value: string): string | undefined {
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

function validateAll(form: FormValues): FormErrors {
  const errs: FormErrors = {};
  const fields: Array<keyof FormValues> = ['sku', 'name', 'price_xof', 'stock_qty', 'unit', 'image_url'];
  for (const f of fields) {
    const e = validateField(f, form[f]);
    if (e) (errs as Record<string, string>)[f] = e;
  }
  return errs;
}

export default function ProductManager() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setPageState('loading');
    setLoadError('');
    try {
      const data = await fetchMyProducts();
      setProducts(data);
      setPageState('success');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Erreur inconnue');
      setPageState('error');
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  function openCreateModal() {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setTouched({});
    setSubmitError('');
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      price_xof: String(product.price_xof),
      stock_qty: String(product.stock_qty),
      unit: product.unit,
      image_url: product.image_url ?? '',
    });
    setErrors({});
    setTouched({});
    setSubmitError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
    setSubmitError('');
  }

  function handleChange(field: keyof FormValues, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  }

  function handleBlur(field: keyof FormValues) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, form[field]);
    setErrors((prev) => ({ ...prev, [field]: err }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allErrors = validateAll(form);
    setErrors(allErrors);
    setTouched({ sku: true, name: true, price_xof: true, stock_qty: true, unit: true, image_url: true });
    if (Object.values(allErrors).some(Boolean)) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      if (editingProduct) {
        const payload: UpdateProductPayload = {
          name: form.name,
          description: form.description || undefined,
          price_xof: Number(form.price_xof),
          stock_qty: Number(form.stock_qty),
          unit: form.unit,
          image_url: form.image_url || undefined,
        };
        await updateProduct(editingProduct.id, payload);
      } else {
        const payload: CreateProductPayload = {
          sku: form.sku,
          name: form.name,
          description: form.description || undefined,
          price_xof: Number(form.price_xof),
          stock_qty: Number(form.stock_qty),
          unit: form.unit,
          image_url: form.image_url || undefined,
        };
        await createProduct(payload);
      }
      closeModal();
      await loadProducts();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteProduct(id);
      setDeleteConfirm(null);
      await loadProducts();
    } catch {
      /* soft fail for delete */
    } finally {
      setDeletingId(null);
    }
  }

  if (pageState === 'loading') {
    return (
      <div className="catalog-page" data-testid="product-manager">
        <div className="catalog-container ws-container">
          <div className="ws-loading" data-testid="pm-loading">
            <div className="ws-spinner" />
            <p className="ws-loading-text">Chargement du catalogue…</p>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="catalog-page" data-testid="product-manager">
        <div className="catalog-container ws-container">
          <div className="ws-error-card" data-testid="pm-error">
            <p className="ws-error-msg">{loadError}</p>
            <button
              className="ws-btn ws-btn--primary"
              data-testid="pm-retry-btn"
              onClick={() => void loadProducts()}
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="catalog-page" data-testid="product-manager">
      <div className="catalog-container ws-container">
        {/* Header */}
        <header className="ws-header">
          <div className="ws-header-left">
            <h1 className="ws-title" data-testid="pm-title">Mon catalogue</h1>
            <p className="ws-subtitle">{products.length} produit{products.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="ws-header-actions">
            <button
              className="ws-btn ws-btn--primary"
              data-testid="pm-add-btn"
              onClick={openCreateModal}
            >
              + Ajouter un produit
            </button>
          </div>
        </header>

        {/* Empty State */}
        {products.length === 0 && (
          <div className="pm-empty" data-testid="pm-empty">
            <span className="pm-empty-icon" aria-hidden="true">📦</span>
            <p className="pm-empty-text">Votre catalogue est vide.</p>
            <button
              className="ws-btn ws-btn--primary"
              onClick={openCreateModal}
            >
              Créer mon premier produit
            </button>
          </div>
        )}

        {/* Product Table */}
        {products.length > 0 && (
          <div className="pm-table-wrap" data-testid="pm-product-list">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Produit</th>
                  <th>Prix (XOF)</th>
                  <th>Stock</th>
                  <th>Unité</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} data-testid="pm-product-row">
                    <td className="pm-cell-sku">{p.sku}</td>
                    <td className="pm-cell-name">{p.name}</td>
                    <td className="pm-cell-price">{formatXOF(p.price_xof)}</td>
                    <td>
                      <span
                        className={`ws-stock-badge ${
                          p.stock_qty === 0
                            ? 'ws-stock-badge--zero'
                            : p.stock_qty <= 10
                              ? 'ws-stock-badge--low'
                              : 'ws-stock-badge--ok'
                        }`}
                        data-testid="pm-stock-badge"
                      >
                        {p.stock_qty}
                      </span>
                    </td>
                    <td className="pm-cell-unit">{p.unit}</td>
                    <td className="pm-cell-actions">
                      <button
                        className="ws-btn ws-btn--sm ws-btn--ghost"
                        data-testid="pm-edit-btn"
                        onClick={() => openEditModal(p)}
                      >
                        Modifier
                      </button>
                      {deleteConfirm === p.id ? (
                        <span className="pm-delete-confirm">
                          <button
                            className="ws-btn ws-btn--sm ws-btn--danger"
                            data-testid="pm-delete-confirm"
                            disabled={deletingId === p.id}
                            onClick={() => void handleDelete(p.id)}
                          >
                            {deletingId === p.id ? '…' : 'Confirmer'}
                          </button>
                          <button
                            className="ws-btn ws-btn--sm ws-btn--secondary"
                            data-testid="pm-delete-cancel"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <button
                          className="ws-btn ws-btn--sm ws-btn--ghost ws-btn--danger-text"
                          data-testid="pm-delete-btn"
                          onClick={() => setDeleteConfirm(p.id)}
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Modal Overlay ────────────────────────────── */}
        {modalOpen && (
          <div
            className="pm-modal-overlay"
            data-testid="pm-modal"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
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
                <div className="pm-field">
                  <label className="pm-label" htmlFor="pm-sku">SKU</label>
                  <input
                    id="pm-sku"
                    className={`pm-input ${errors.sku ? 'pm-input--error' : ''}`}
                    data-testid="pm-field-sku"
                    value={form.sku}
                    disabled={!!editingProduct}
                    onChange={(e) => handleChange('sku', e.target.value)}
                    onBlur={() => handleBlur('sku')}
                    placeholder="EX: RIZ-50KG"
                  />
                  {errors.sku && <span className="pm-error-hint" data-testid="pm-error-sku">{errors.sku}</span>}
                </div>

                <div className="pm-field">
                  <label className="pm-label" htmlFor="pm-name">Nom du produit</label>
                  <input
                    id="pm-name"
                    className={`pm-input ${errors.name ? 'pm-input--error' : ''}`}
                    data-testid="pm-field-name"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                    placeholder="Riz parfumé 50 kg"
                  />
                  {errors.name && <span className="pm-error-hint" data-testid="pm-error-name">{errors.name}</span>}
                </div>

                <div className="pm-field">
                  <label className="pm-label" htmlFor="pm-desc">Description (optionnel)</label>
                  <textarea
                    id="pm-desc"
                    className="pm-input pm-textarea"
                    data-testid="pm-field-description"
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    placeholder="Détails du produit…"
                  />
                </div>

                <div className="pm-field-row">
                  <div className="pm-field">
                    <label className="pm-label" htmlFor="pm-price">Prix (XOF)</label>
                    <input
                      id="pm-price"
                      type="number"
                      className={`pm-input ${errors.price_xof ? 'pm-input--error' : ''}`}
                      data-testid="pm-field-price"
                      value={form.price_xof}
                      onChange={(e) => handleChange('price_xof', e.target.value)}
                      onBlur={() => handleBlur('price_xof')}
                      min={1}
                      step={1}
                      placeholder="15000"
                    />
                    {errors.price_xof && <span className="pm-error-hint" data-testid="pm-error-price">{errors.price_xof}</span>}
                  </div>
                  <div className="pm-field">
                    <label className="pm-label" htmlFor="pm-stock">Stock</label>
                    <input
                      id="pm-stock"
                      type="number"
                      className={`pm-input ${errors.stock_qty ? 'pm-input--error' : ''}`}
                      data-testid="pm-field-stock"
                      value={form.stock_qty}
                      onChange={(e) => handleChange('stock_qty', e.target.value)}
                      onBlur={() => handleBlur('stock_qty')}
                      min={0}
                      step={1}
                      placeholder="200"
                    />
                    {errors.stock_qty && <span className="pm-error-hint" data-testid="pm-error-stock">{errors.stock_qty}</span>}
                  </div>
                </div>

                <div className="pm-field-row">
                  <div className="pm-field">
                    <label className="pm-label" htmlFor="pm-unit">Unité</label>
                    <input
                      id="pm-unit"
                      className={`pm-input ${errors.unit ? 'pm-input--error' : ''}`}
                      data-testid="pm-field-unit"
                      value={form.unit}
                      onChange={(e) => handleChange('unit', e.target.value)}
                      onBlur={() => handleBlur('unit')}
                      placeholder="kg"
                    />
                    {errors.unit && <span className="pm-error-hint" data-testid="pm-error-unit">{errors.unit}</span>}
                  </div>
                  <div className="pm-field">
                    <label className="pm-label" htmlFor="pm-img">Image URL (optionnel)</label>
                    <input
                      id="pm-img"
                      className={`pm-input ${errors.image_url ? 'pm-input--error' : ''}`}
                      data-testid="pm-field-image"
                      value={form.image_url}
                      onChange={(e) => handleChange('image_url', e.target.value)}
                      onBlur={() => handleBlur('image_url')}
                      placeholder="https://…"
                    />
                    {errors.image_url && <span className="pm-error-hint" data-testid="pm-error-image">{errors.image_url}</span>}
                  </div>
                </div>

                <div className="pm-modal-actions">
                  <button
                    type="button"
                    className="ws-btn ws-btn--secondary"
                    data-testid="pm-cancel-btn"
                    onClick={closeModal}
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
        )}
      </div>
    </div>
  );
}
