import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { placeOrder, ApiError } from '../api/client.js';
import { useCart } from '../context/CartContext.js';
import '../components/primitives/catalog.css';
import '../components/primitives/auth.css';

/* ── XOF formatter ───────────────────────────────────── */

function formatXOF(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' F';
}

/* ── Component ───────────────────────────────────────── */

export default function Cart() {
  const {
    items,
    wholesalerOrgId,
    totalAmount,
    itemCount,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useCart();

  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Place order ──────────────────────────────────── */

  const handleCheckout = useCallback(async () => {
    if (!wholesalerOrgId || items.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const order = await placeOrder({
        wholesaler_org_id: wholesalerOrgId,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      });

      clearCart();
      navigate(`/buyer/order-confirmation/${order.id}`, {
        state: { orderId: order.id, totalXof: order.total_xof },
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Impossible de placer la commande';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [wholesalerOrgId, items, clearCart, navigate]);

  /* ── Render: Empty Cart ───────────────────────────── */

  if (items.length === 0) {
    return (
      <div className="catalog-page" data-testid="cart-page">
        <div className="catalog-container">
          <Link to="/buyer/catalog" className="detail-back">
            &#8592; Retour au catalogue
          </Link>
          <div className="cart-empty" data-testid="cart-empty">
            <div className="cart-empty-icon">&#128722;</div>
            <h2 className="cart-empty-title">Votre panier est vide</h2>
            <p className="cart-empty-text">
              Parcourez le catalogue pour ajouter des produits
            </p>
            <Link to="/buyer/catalog" className="cart-empty-cta">
              Voir le catalogue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render: Cart with Items ──────────────────────── */

  return (
    <div className="catalog-page" data-testid="cart-page">
      <div className="catalog-container">
        <Link to="/buyer/catalog" className="detail-back">
          &#8592; Retour au catalogue
        </Link>

        <div className="catalog-header">
          <h1 className="catalog-title">Panier</h1>
          <p className="catalog-subtitle" data-testid="cart-count">
            {itemCount} article{itemCount !== 1 ? 's' : ''} &middot; Grossiste{' '}
            {wholesalerOrgId?.slice(0, 8)}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="cart-error-banner" data-testid="cart-error">
            <p className="cart-error-text">{error}</p>
          </div>
        )}

        {/* Items list */}
        <div className="cart-items" data-testid="cart-items">
          {items.map((item) => {
            const lineTotal = Number(item.product.price_xof) * item.quantity;
            return (
              <div
                key={item.product.id}
                className="cart-item"
                data-testid="cart-item"
              >
                {/* Image */}
                {item.product.image_url ? (
                  <img
                    className="cart-item-img"
                    src={item.product.image_url}
                    alt={item.product.name}
                  />
                ) : (
                  <div className="cart-item-img-placeholder" aria-hidden="true">
                    &#128722;
                  </div>
                )}

                {/* Info */}
                <div className="cart-item-info">
                  <p className="cart-item-name">{item.product.name}</p>
                  <p className="cart-item-price">
                    {formatXOF(Number(item.product.price_xof))} / {item.product.unit}
                  </p>
                </div>

                {/* Quantity controls */}
                <div className="cart-item-qty">
                  <button
                    className="detail-qty-btn"
                    disabled={item.quantity <= 1}
                    onClick={() =>
                      updateQuantity(item.product.id, item.quantity - 1)
                    }
                    aria-label="Diminuer"
                    data-testid={`qty-minus-${item.product.id}`}
                  >
                    &minus;
                  </button>
                  <span
                    className="detail-qty-value"
                    data-testid={`qty-value-${item.product.id}`}
                  >
                    {item.quantity}
                  </span>
                  <button
                    className="detail-qty-btn"
                    disabled={item.quantity >= item.product.stock_qty}
                    onClick={() =>
                      updateQuantity(item.product.id, item.quantity + 1)
                    }
                    aria-label="Augmenter"
                    data-testid={`qty-plus-${item.product.id}`}
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <span className="cart-item-total" data-testid={`line-total-${item.product.id}`}>
                  {formatXOF(lineTotal)}
                </span>

                {/* Remove */}
                <button
                  className="cart-item-remove"
                  onClick={() => removeFromCart(item.product.id)}
                  aria-label={`Retirer ${item.product.name}`}
                  data-testid={`remove-${item.product.id}`}
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>

        {/* Summary & Checkout */}
        <div className="cart-summary" data-testid="cart-summary">
          <div className="cart-summary-row">
            <span className="cart-summary-label">Total</span>
            <span className="cart-summary-value" data-testid="cart-total">
              {formatXOF(totalAmount)}
            </span>
          </div>

          <button
            className="detail-add-btn cart-checkout-btn"
            disabled={submitting}
            onClick={() => void handleCheckout()}
            data-testid="checkout-btn"
          >
            {submitting ? (
              <>
                <span className="auth-spinner auth-spinner--btn" aria-hidden="true" />
                Envoi en cours...
              </>
            ) : (
              `Placer la commande — ${formatXOF(totalAmount)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
