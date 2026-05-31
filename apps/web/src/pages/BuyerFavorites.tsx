import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getFavorites, removeFavorite, ApiError } from '../api/client.js';
import type { FavoriteItem } from '../api/client.js';
import { useCart, type CartConflict } from '../context/CartContext.js';
import { categoryLabel } from '../constants/categories.js';
import '../components/primitives/catalog.css';

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

export default function BuyerFavorites() {
  const { addToCart, forceAddToCart } = useCart();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ item: FavoriteItem; result: CartConflict } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null); // productId being removed

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFavorites();
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les favoris');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRemove = useCallback(async (productId: string) => {
    setRemoving(productId);
    try {
      await removeFavorite(productId);
      setItems((prev) => prev.filter((i) => i.product_id !== productId));
    } catch {
      // silently ignore — item stays in list
    } finally {
      setRemoving(null);
    }
  }, []);

  const handleAddToCart = useCallback((item: FavoriteItem) => {
    const product = {
      id: item.product_id,
      organization_id: item.product_organization_id,
      sku: item.product_sku,
      name: item.product_name,
      description: null,
      price_xof: item.product_price_xof,
      stock_qty: item.product_stock_qty,
      unit: item.product_unit,
      category: item.product_category,
      image_url: item.product_image_url,
      created_at: item.created_at,
      updated_at: item.created_at,
    };
    const result = addToCart(product, 1);
    if (result) setConflict({ item, result });
  }, [addToCart]);

  const handleForceAdd = useCallback(() => {
    if (!conflict) return;
    const { item } = conflict;
    forceAddToCart({
      id: item.product_id,
      organization_id: item.product_organization_id,
      sku: item.product_sku,
      name: item.product_name,
      description: null,
      price_xof: item.product_price_xof,
      stock_qty: item.product_stock_qty,
      unit: item.product_unit,
      category: item.product_category,
      image_url: item.product_image_url,
      created_at: item.created_at,
      updated_at: item.created_at,
    }, 1);
    setConflict(null);
  }, [conflict, forceAddToCart]);

  /* ── Loading ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="catalog-page" data-testid="favorites-page">
        <div className="catalog-container">
          <div className="catalog-header"><h1 className="catalog-title">Mes Favoris</h1></div>
          <div className="catalog-grid" data-testid="favorites-loading">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="catalog-skeleton catalog-skeleton-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────── */
  if (error) {
    return (
      <div className="catalog-page" data-testid="favorites-page">
        <div className="catalog-container">
          <div className="catalog-error" data-testid="favorites-error">
            <p className="catalog-error-text">{error}</p>
            <button className="catalog-retry-btn" onClick={() => void load()}>Réessayer</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Success ─────────────────────────────────────────── */
  return (
    <div className="catalog-page" data-testid="favorites-page">
      <div className="catalog-container">
        <div className="catalog-header">
          <h1 className="catalog-title">Mes Favoris</h1>
          <p className="catalog-subtitle">{items.length} produit{items.length !== 1 ? 's' : ''} sauvegardé{items.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="catalog-grid" data-testid="favorites-grid">
          {items.length === 0 ? (
            <div className="catalog-empty" data-testid="favorites-empty">
              <div className="catalog-empty-icon">&#9825;</div>
              <p className="catalog-empty-text">Aucun favori pour l&apos;instant</p>
              <Link to="/buyer/catalog" className="catalog-retry-btn">
                Parcourir le catalogue
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="catalog-card fav-card" data-testid="fav-card">
                <Link to={`/buyer/products/${item.product_id}`} className="fav-card-link">
                  {item.product_image_url ? (
                    <img className="catalog-card-img" src={item.product_image_url} alt={item.product_name} />
                  ) : (
                    <div className="catalog-card-img-placeholder" aria-hidden="true">&#128722;</div>
                  )}
                  <div className="catalog-card-body">
                    <p className="catalog-card-name">{item.product_name}</p>
                    <p className="catalog-card-org">{item.org_name} · {categoryLabel(item.product_category)}</p>
                    <div className="catalog-card-footer">
                      <span className="catalog-card-price">
                        {formatXOF(item.product_price_xof)}
                        <span className="catalog-card-unit"> / {item.product_unit}</span>
                      </span>
                      {item.product_stock_qty > 0 ? (
                        <span className="catalog-badge catalog-badge--in-stock">
                          <span className="catalog-badge-dot" />En stock
                        </span>
                      ) : (
                        <span className="catalog-badge catalog-badge--out">
                          <span className="catalog-badge-dot" />Rupture
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                <div className="fav-card-actions">
                  <button
                    className="fav-add-btn"
                    disabled={item.product_stock_qty === 0}
                    onClick={() => handleAddToCart(item)}
                    data-testid="fav-add-to-cart"
                  >
                    🛒 Ajouter au panier
                  </button>
                  <button
                    className="fav-remove-btn"
                    disabled={removing === item.product_id}
                    onClick={() => void handleRemove(item.product_id)}
                    data-testid="fav-remove"
                    aria-label="Retirer des favoris"
                  >
                    ♥
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Mono-wholesaler conflict modal ──────────────── */}
      {conflict && (
        <div className="cart-conflict-overlay" data-testid="fav-conflict-modal">
          <div className="cart-conflict-modal">
            <h3 className="cart-conflict-title">Changer de grossiste ?</h3>
            <p className="cart-conflict-text">
              Votre panier contient des produits d&apos;un autre grossiste.
              Voulez-vous vider le panier et ajouter ce produit ?
            </p>
            <div className="cart-conflict-actions">
              <button
                className="cart-conflict-btn cart-conflict-btn--cancel"
                onClick={() => setConflict(null)}
                data-testid="fav-conflict-cancel"
              >
                Annuler
              </button>
              <button
                className="cart-conflict-btn cart-conflict-btn--confirm"
                onClick={handleForceAdd}
                data-testid="fav-conflict-confirm"
              >
                Vider et ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
