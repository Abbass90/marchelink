import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchOrderDetailForBuyer, fetchOrderTimeline, ApiError } from '../api/client.js';
import type { OrderDetailResponse } from '../api/client.js';
import OrderTimeline from '../components/features/OrderTimeline.js';
import { SWIFTGO_URL } from '../config/site.js';
import '../components/primitives/catalog.css';

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  paid: 'Payée',
  shipped: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  rejected: 'Refusée',
};

function statusClass(status: string): string {
  if (status === 'delivered') return 'bod-status bod-status--success';
  if (status === 'cancelled' || status === 'rejected') return 'bod-status bod-status--danger';
  if (status === 'paid' || status === 'shipped') return 'bod-status bod-status--info';
  if (status === 'accepted') return 'bod-status bod-status--accepted';
  return 'bod-status bod-status--pending';
}

export default function BuyerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrderDetailForBuyer(id);
      setOrder(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  return (
    <div className="bo-page" data-testid="buyer-order-detail">
      <Link to="/buyer/orders" className="bod-back-link" data-testid="bod-back-link">
        ← Mes commandes
      </Link>

      {/* ── Loading ────────────────────────────────────────── */}
      {loading && (
        <div className="bod-loading" data-testid="bod-loading">
          <div className="bod-skeleton-header" />
          <div className="bod-skeleton-line" />
          <div className="bod-skeleton-line bod-skeleton-line--short" />
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────── */}
      {error && !loading && (
        <div className="bod-error" data-testid="bod-error">
          <p>{error}</p>
          <button className="bo-retry-btn" data-testid="bod-retry-btn" onClick={() => void loadOrder()}>
            Réessayer
          </button>
        </div>
      )}

      {/* ── Success ───────────────────────────────────────── */}
      {!loading && !error && order && (
        <>
          {/* ── En-tête ───────────────────────────────────── */}
          <section className="st-card">
            <div className="bod-header">
              <h1 className="st-section-title" data-testid="bod-title">
                Commande #{order.id.slice(0, 8).toUpperCase()}
              </h1>
              <span className={statusClass(order.status)} data-testid="bod-status">
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
            </div>
            <p className="st-label">
              Passée le {new Date(order.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>

            {/* ── Lignes produits ───────────────────────── */}
            {order.items.length > 0 && (
              <div className="bod-items" data-testid="bod-items">
                {order.items.map((item) => (
                  <div key={item.id} className="bod-item-row" data-testid="bod-item">
                    <span className="bod-item-name">{item.product_name}</span>
                    <span className="bod-item-qty">
                      {item.quantity}&nbsp;{item.product_unit}
                    </span>
                    <span className="bod-item-unit-price">{formatXOF(item.unit_price_xof)}</span>
                    <span className="bod-item-line">{formatXOF(item.line_total_xof)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Total ─────────────────────────────────── */}
            <div className="bod-total-row">
              <span className="bod-total-label">Total</span>
              <span className="bod-total-value" data-testid="bod-total">
                {formatXOF(order.total_xof)}
              </span>
            </div>

            {/* ── Bouton payer (status accepted) ────────── */}
            {order.status === 'accepted' && (
              <div className="bod-actions">
                <Link
                  to={`/buyer/pay/${order.id}`}
                  className="bo-action-btn bo-action-btn--pay"
                  data-testid="bod-pay-link"
                >
                  Payer maintenant
                </Link>
              </div>
            )}
          </section>

          {/* ── Grossiste ─────────────────────────────────── */}
          <section className="st-card">
            <p className="st-label">Grossiste</p>
            <div className="bod-org-row">
              <span className="bod-org-name" data-testid="bod-org-name">
                {order.org_name}
              </span>
              <Link
                to="/buyer/chat"
                className="bod-chat-link"
                data-testid="bod-chat-link"
              >
                Discuter
              </Link>
            </div>
          </section>

          {/* ── Livraison ─────────────────────────────────── */}
          {order.delivery_mode !== null && (
            <section className="st-card">
              <p className="st-label">Mode de livraison</p>
              {order.delivery_mode === 'swiftgo' ? (
                <a
                  href={SWIFTGO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bod-swiftgo-link"
                  data-testid="bod-swiftgo-link"
                >
                  Suivi SwiftGo →
                </a>
              ) : (
                <span className="bod-delivery-label" data-testid="bod-delivery-mode">
                  Livraison grossiste
                </span>
              )}
            </section>
          )}

          {/* ── Timeline ──────────────────────────────────── */}
          {id && <OrderTimeline orderId={id} fetchFn={fetchOrderTimeline} />}
        </>
      )}
    </div>
  );
}
