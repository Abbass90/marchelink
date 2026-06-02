import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { fetchMyOrders, cancelOrder, ApiError } from '../api/client.js';
import type { OrderResponse } from '../api/client.js';
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
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'accepted', label: 'Acceptées' },
  { value: 'paid', label: 'Payées' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'cancelled', label: 'Annulées' },
];

function statusClass(status: string): string {
  if (status === 'delivered') return 'bo-status bo-status--success';
  if (status === 'cancelled') return 'bo-status bo-status--danger';
  if (status === 'paid' || status === 'shipped') return 'bo-status bo-status--info';
  return 'bo-status bo-status--pending';
}

export default function BuyerOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyOrders();
      setOrders(data);
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : 'Impossible de charger vos commandes';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter(o => o.status === filter);
  }, [orders, filter]);

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    setCancelError(null);
    try {
      await cancelOrder(orderId);
      await loadOrders();
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : 'Impossible d\'annuler cette commande';
      setCancelError(message);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="bo-page" data-testid="buyer-orders">
      {/* ── Title ───────────────────────────────────── */}
      <header className="bo-header">
        <div>
          <h1 className="bo-title">Mes Commandes</h1>
        </div>
      </header>

      {/* ── Filter Tabs ─────────────────────────────── */}
      <nav className="bo-filters" data-testid="bo-filters">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`bo-filter-btn ${filter === opt.value ? 'bo-filter-btn--active' : ''}`}
            data-testid={`bo-filter-${opt.value}`}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
            {opt.value !== 'all' && (
              <span className="bo-filter-count">
                {orders.filter(o => o.status === opt.value).length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Cancel Error ────────────────────────────── */}
      {cancelError && (
        <div className="bo-cancel-error" data-testid="bo-cancel-error">
          {cancelError}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────── */}
      {loading && (
        <div className="bo-loading" data-testid="bo-loading">
          <div className="bo-spinner" />
          <span>Chargement…</span>
        </div>
      )}

      {/* ── Error ───────────────────────────────────── */}
      {error && !loading && (
        <div className="bo-error" data-testid="bo-error">
          <p>{error}</p>
          <button className="bo-retry-btn" data-testid="bo-retry-btn" onClick={() => void loadOrders()}>
            Réessayer
          </button>
        </div>
      )}

      {/* ── Empty ───────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bo-empty" data-testid="bo-empty">
          <p>
            {filter === 'all'
              ? 'Vous n\'avez pas encore de commande.'
              : `Aucune commande « ${STATUS_LABELS[filter] ?? filter} ».`}
          </p>
          {filter === 'all' && (
            <Link to="/buyer/catalog" className="bo-cta-btn">
              Parcourir le catalogue
            </Link>
          )}
        </div>
      )}

      {/* ── Order List ──────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bo-list" data-testid="bo-list">
          {filtered.map(order => (
            <div
              key={order.id}
              className="bo-card"
              data-testid="bo-card"
              tabIndex={0}
              onClick={() => navigate(`/buyer/order-confirmation/${order.id}`)}
              onKeyDown={e => { if (e.key === 'Enter') navigate(`/buyer/order-confirmation/${order.id}`); }}
            >
              <div className="bo-card-top">
                <span className="bo-order-id">#{order.id.slice(0, 8)}</span>
                <span className={statusClass(order.status)}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>

              <div className="bo-card-mid">
                <span className="bo-total">{formatXOF(order.total_xof)}</span>
                <span className="bo-date">
                  {new Date(order.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {order.items && order.items.length > 0 && (
                <div className="bo-items-count">
                  {order.items.length} article{order.items.length > 1 ? 's' : ''}
                </div>
              )}

              {/* ── Actions ─────────────────────────── */}
              <div className="bo-card-actions" onClick={e => e.stopPropagation()}>
                <Link
                  to={`/buyer/orders/${order.id}`}
                  className="bo-action-btn bo-action-btn--detail"
                  data-testid="bo-detail-link"
                >
                  Voir les détails
                </Link>
                {order.status === 'pending' && (
                  <>
                    <button
                      className="bo-action-btn bo-action-btn--pay"
                      data-testid="bo-pay-btn"
                      onClick={() => navigate(`/buyer/pay/${order.id}`)}
                    >
                      Payer
                    </button>
                    <button
                      className="bo-action-btn bo-action-btn--cancel"
                      data-testid="bo-cancel-btn"
                      disabled={cancellingId === order.id}
                      onClick={() => void handleCancel(order.id)}
                    >
                      {cancellingId === order.id ? 'Annulation…' : 'Annuler'}
                    </button>
                  </>
                )}
                {order.status === 'accepted' && (
                  <button
                    className="bo-action-btn bo-action-btn--pay"
                    data-testid="bo-pay-btn"
                    onClick={() => navigate(`/buyer/pay/${order.id}`)}
                  >
                    Payer maintenant
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
