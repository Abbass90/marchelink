import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProduct, getFavorites, addFavorite, removeFavorite, ApiError } from '../api/client.js';
import type { Product } from '../api/client.js';
import { useCart, type CartConflict } from '../context/CartContext.js';
import '../components/primitives/catalog.css';
import '../components/primitives/auth.css'; /* reuse @keyframes auth-spin */

/* ── XOF formatter ───────────────────────────────────── */

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

/* ── Component ───────────────────────────────────────── */

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { addToCart, forceAddToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [conflict, setConflict] = useState<CartConflict | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [favLoading, setFavLoading] = useState(false);

  /* ── Fetch product ─────────────────────────────────── */

  const loadProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [data, favs] = await Promise.all([fetchProduct(id), getFavorites()]);
      setProduct(data);
      setIsFavorited(favs.some((f) => f.product_id === id));
    } catch (err) {
      const message = err instanceof ApiError
        ? (err.status === 404 ? 'Produit introuvable' : err.message)
        : 'Impossible de charger le produit';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleFavoriteToggle = useCallback(async () => {
    if (!product || favLoading) return;
    setFavLoading(true);
    const nextState = !isFavorited;
    setIsFavorited(nextState); // optimistic
    try {
      if (nextState) {
        await addFavorite(product.id);
      } else {
        await removeFavorite(product.id);
      }
    } catch {
      setIsFavorited(!nextState); // revert on error
    } finally {
      setFavLoading(false);
    }
  }, [product, isFavorited, favLoading]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  /* ── Quantity handlers ─────────────────────────────── */

  const maxQty = product?.stock_qty ?? 0;
  const decrement = useCallback(() => setQuantity((q) => Math.max(1, q - 1)), []);
  const increment = useCallback(
    () => setQuantity((q) => Math.min(maxQty, q + 1)),
    [maxQty],
  );

  /* ── Cart handlers ────────────────────────────────── */

  const handleAddToCart = useCallback(() => {
    if (!product) return;
    const result = addToCart(product, quantity);
    if (result) {
      setConflict(result);
    } else {
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2000);
    }
  }, [product, quantity, addToCart]);

  const handleForceAdd = useCallback(() => {
    if (!product) return;
    forceAddToCart(product, quantity);
    setConflict(null);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  }, [product, quantity, forceAddToCart]);

  const handleCancelConflict = useCallback(() => {
    setConflict(null);
  }, []);

  /* ── Render: Loading ───────────────────────────────── */

  if (loading) {
    return (
      <div className="detail-page" data-testid="detail-page">
        <div className="detail-container">
          <div className="detail-loading" data-testid="detail-loading">
            <div className="detail-spinner" role="status" aria-label="Chargement" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Render: Error ─────────────────────────────────── */

  if (error || !product) {
    return (
      <div className="detail-page" data-testid="detail-page">
        <div className="detail-container">
          <Link to="/buyer/catalog" className="detail-back">
            &#8592; Retour au catalogue
          </Link>
          <div className="catalog-error" data-testid="detail-error">
            <p className="catalog-error-text">{error ?? 'Produit introuvable'}</p>
            <button className="catalog-retry-btn" onClick={() => void loadProduct()}>
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render: Success ───────────────────────────────── */

  const inStock = product.stock_qty > 0;

  return (
    <div className="detail-page" data-testid="detail-page">
      <div className="detail-container">
        <Link to="/buyer/catalog" className="detail-back">
          &#8592; Retour au catalogue
        </Link>

        <div className="detail-card">
          {/* Image */}
          {product.image_url ? (
            <img
              className="detail-img"
              src={product.image_url}
              alt={product.name}
            />
          ) : (
            <div className="detail-img-placeholder" aria-hidden="true">
              &#128722;
            </div>
          )}

          {/* Info */}
          <div className="detail-info">
            <span className="detail-sku" data-testid="detail-sku">
              SKU: {product.sku}
            </span>
            <div className="detail-name-row">
              <h1 className="detail-name" data-testid="detail-name">
                {product.name}
              </h1>
              <button
                className={`detail-fav-btn${isFavorited ? ' detail-fav-btn--active' : ''}`}
                onClick={() => void handleFavoriteToggle()}
                disabled={favLoading}
                aria-label={isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                data-testid="fav-toggle"
              >
                {isFavorited ? '♥' : '♡'}
              </button>
            </div>
            <p className="detail-org">
              Grossiste {product.organization_id.slice(0, 8)}
            </p>

            {inStock ? (
              <span className="catalog-badge catalog-badge--in-stock" data-testid="detail-stock-badge">
                <span className="catalog-badge-dot" />
                En stock ({product.stock_qty} {product.unit}{product.stock_qty > 1 ? 's' : ''})
              </span>
            ) : (
              <span className="catalog-badge catalog-badge--out" data-testid="detail-stock-badge">
                <span className="catalog-badge-dot" />
                Rupture de stock
              </span>
            )}

            {product.description && (
              <p className="detail-description" data-testid="detail-description">
                {product.description}
              </p>
            )}

            <hr className="detail-divider" />

            <span className="detail-price" data-testid="detail-price">
              {formatXOF(product.price_xof)}
              <span className="detail-price-unit"> / {product.unit}</span>
            </span>

            {/* Quantity selector */}
            <div className="detail-quantity" data-testid="detail-quantity">
              <button
                className="detail-qty-btn"
                onClick={decrement}
                disabled={quantity <= 1 || !inStock}
                aria-label="Diminuer la quantité"
                data-testid="qty-minus"
              >
                &minus;
              </button>
              <span className="detail-qty-value" data-testid="qty-value">
                {quantity}
              </span>
              <button
                className="detail-qty-btn"
                onClick={increment}
                disabled={quantity >= maxQty || !inStock}
                aria-label="Augmenter la quantité"
                data-testid="qty-plus"
              >
                +
              </button>
              <span className="detail-qty-label">
                {product.unit}{quantity > 1 ? 's' : ''}
              </span>
            </div>

            {/* Add to cart */}
            <button
              className={`detail-add-btn${addedFeedback ? ' detail-add-btn--success' : ''}`}
              disabled={!inStock}
              onClick={handleAddToCart}
              data-testid="add-to-cart"
            >
              {!inStock
                ? 'Indisponible'
                : addedFeedback
                  ? 'Ajouté au panier !'
                  : `Ajouter au panier — ${formatXOF(String(Number(product.price_xof) * quantity))}`}
            </button>

            {/* Cart link */}
            <Link to="/buyer/cart" className="detail-cart-link" data-testid="go-to-cart">
              Voir le panier
            </Link>
          </div>
        </div>
      </div>

      {/* ── Mono-wholesaler conflict modal ─────────────── */}
      {conflict && (
        <div className="cart-conflict-overlay" data-testid="conflict-modal">
          <div className="cart-conflict-modal">
            <h3 className="cart-conflict-title">Changer de grossiste ?</h3>
            <p className="cart-conflict-text">
              Votre panier contient des produits d&apos;un autre grossiste.
              Voulez-vous vider le panier et ajouter ce produit ?
            </p>
            <div className="cart-conflict-actions">
              <button
                className="cart-conflict-btn cart-conflict-btn--cancel"
                onClick={handleCancelConflict}
                data-testid="conflict-cancel"
              >
                Annuler
              </button>
              <button
                className="cart-conflict-btn cart-conflict-btn--confirm"
                onClick={handleForceAdd}
                data-testid="conflict-confirm"
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
