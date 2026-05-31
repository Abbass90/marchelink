import { useState, useEffect, useCallback } from 'react';
import {
  fetchMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
} from '../api/client.js';
import ProductTable from '../components/features/product-manager/ProductTable.js';
import ProductFormModal from '../components/features/product-manager/ProductFormModal.js';
import {
  buildCreatePayload,
  buildUpdatePayload,
  type FormValues,
} from '../components/features/product-manager/product-form.helpers.js';
import '../components/primitives/catalog.css';

type PageState = 'loading' | 'error' | 'success';

export default function ProductManager() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
  }

  async function submitProduct(values: FormValues) {
    if (editingProduct) {
      await updateProduct(editingProduct.id, buildUpdatePayload(values));
    } else {
      await createProduct(buildCreatePayload(values));
    }
    closeModal();
    await loadProducts();
  }

  async function handleDelete(id: string) {
    await deleteProduct(id);
    await loadProducts();
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

  return (
    <div className="catalog-page" data-testid="product-manager">
      <div className="catalog-container ws-container">
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

        {products.length === 0 && (
          <div className="pm-empty" data-testid="pm-empty">
            <span className="pm-empty-icon" aria-hidden="true">📦</span>
            <p className="pm-empty-text">Votre catalogue est vide.</p>
            <button className="ws-btn ws-btn--primary" onClick={openCreateModal}>
              Créer mon premier produit
            </button>
          </div>
        )}

        {products.length > 0 && (
          <ProductTable products={products} onEdit={openEditModal} onDelete={handleDelete} />
        )}

        {modalOpen && (
          <ProductFormModal
            editingProduct={editingProduct}
            onClose={closeModal}
            onSubmit={submitProduct}
          />
        )}
      </div>
    </div>
  );
}
