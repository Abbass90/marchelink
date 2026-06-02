import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchOrgOrder, fetchOrgOrderTimeline, updateOrderStatus, setDeliveryMode, ApiError } from '../api/client.js';
import type { OrderResponse } from '../api/client.js';
import OrderTimeline from '../components/features/OrderTimeline.js';
import { SWIFTGO_URL } from '../config/site.js';
import '../components/primitives/catalog.css';

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', accepted: 'Acceptée', rejected: 'Refusée',
  paid: 'Payée', shipped: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée',
};

export default function WholesalerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchOrgOrder(id)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatus = async (status: 'accepted' | 'rejected' | 'shipped' | 'delivered') => {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await updateOrderStatus(id, status);
      setOrder(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action impossible');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliveryMode = async (mode: 'wholesaler' | 'swiftgo') => {
    if (!id) return;
    setDeliveryLoading(true);
    setDeliveryError(null);
    try {
      const updated = await setDeliveryMode(id, mode);
      setOrder(updated);
    } catch (err) {
      setDeliveryError(err instanceof ApiError ? err.message : 'Action impossible');
    } finally {
      setDeliveryLoading(false);
    }
  };

  return (
    <div className="st-page" data-testid="order-detail-page">
      <Link to="/wholesaler/orders" className="wo-back-link" data-testid="od-back-link">
        ← Retour aux commandes
      </Link>

      {loading && (
        <div className="wo-loading" data-testid="od-loading">
          <div className="wo-spinner" />
          <span>Chargement…</span>
        </div>
      )}

      {error && !loading && (
        <div className="wo-error" data-testid="od-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && order && (
        <>
          <section className="st-card">
            <h1 className="st-section-title" data-testid="od-title">
              Commande #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <div className="wo-card-top wo-card-top--detail">
              <span className="wo-total">{formatXOF(order.total_xof)}</span>
              <span className="wo-status">{STATUS_LABELS[order.status] ?? order.status}</span>
            </div>
            <p className="st-label">
              Passée le {new Date(order.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>

            {order.items.length > 0 && (
              <div className="wo-items">
                {order.items.map((item) => (
                  <div key={item.id} className="wo-item-row">
                    <span className="wo-item-qty">{item.quantity}×</span>
                    <span className="wo-item-price">{formatXOF(item.unit_price_xof)}</span>
                    <span className="wo-item-line">{formatXOF(item.line_total_xof)}</span>
                  </div>
                ))}
              </div>
            )}

            {order.status === 'pending' && (
              <div className="wo-card-actions wo-card-actions--detail">
                {actionError && <p className="st-error" data-testid="od-action-error">{actionError}</p>}
                <button
                  className="wo-action-btn wo-action-btn--accept"
                  data-testid="od-accept-btn"
                  disabled={actionLoading}
                  onClick={() => void handleStatus('accepted')}
                >
                  {actionLoading ? '…' : 'Accepter'}
                </button>
                <button
                  className="wo-action-btn wo-action-btn--reject"
                  data-testid="od-reject-btn"
                  disabled={actionLoading}
                  onClick={() => void handleStatus('rejected')}
                >
                  {actionLoading ? '…' : 'Refuser'}
                </button>
              </div>
            )}

            {order.status === 'paid' && (
              <div className="wo-card-actions wo-card-actions--detail">
                {actionError && <p className="st-error" data-testid="od-action-error">{actionError}</p>}
                <button
                  className="wo-action-btn wo-action-btn--accept"
                  data-testid="od-ship-btn"
                  disabled={actionLoading}
                  onClick={() => void handleStatus('shipped')}
                >
                  {actionLoading ? '…' : 'Marquer expédiée'}
                </button>
              </div>
            )}

            {order.status === 'shipped' && (
              <div className="wo-card-actions wo-card-actions--detail">
                {actionError && <p className="st-error" data-testid="od-action-error">{actionError}</p>}
                <button
                  className="wo-action-btn wo-action-btn--accept"
                  data-testid="od-deliver-btn"
                  disabled={actionLoading}
                  onClick={() => void handleStatus('delivered')}
                >
                  {actionLoading ? '…' : 'Marquer livrée'}
                </button>
              </div>
            )}
          </section>

          {/* ── §5 Mode de livraison ───────────────────── */}
          {order.delivery_mode === null &&
            ['accepted', 'paid', 'shipped'].includes(order.status) && (
            <div className="wo-delivery-block" data-testid="delivery-mode-selector">
              <p className="st-label">Mode de livraison</p>
              {deliveryError && (
                <p className="st-error" data-testid="delivery-error">{deliveryError}</p>
              )}
              <div className="wo-card-actions wo-card-actions--detail">
                <button
                  className="wo-action-btn wo-action-btn--accept"
                  data-testid="delivery-wholesaler-btn"
                  disabled={deliveryLoading}
                  onClick={() => void handleDeliveryMode('wholesaler')}
                >
                  {deliveryLoading ? '…' : 'Livraison propre'}
                </button>
                <button
                  className="wo-action-btn wo-action-btn--swiftgo"
                  data-testid="delivery-swiftgo-btn"
                  disabled={deliveryLoading}
                  onClick={() => void handleDeliveryMode('swiftgo')}
                >
                  {deliveryLoading ? '…' : 'SwiftGo'}
                </button>
              </div>
            </div>
          )}

          {order.delivery_mode !== null && (
            <div className="wo-delivery-block" data-testid="delivery-mode-display">
              <p className="st-label">Mode de livraison</p>
              {order.delivery_mode === 'swiftgo' ? (
                <a
                  href={SWIFTGO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wo-action-btn wo-action-btn--swiftgo"
                  data-testid="swiftgo-link"
                >
                  Commander via SwiftGo →
                </a>
              ) : (
                <span className="wo-status" data-testid="delivery-mode-label">
                  Livraison propre
                </span>
              )}
            </div>
          )}

          {id && <OrderTimeline orderId={id} fetchFn={fetchOrgOrderTimeline} />}
        </>
      )}
    </div>
  );
}
