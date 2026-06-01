import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrgOrders, updateOrderStatus, ApiError } from '../api/client.js';
import type { OrderResponse } from '../api/client.js';
import '../components/primitives/catalog.css';

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  rejected: 'Refusée',
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
];

function statusClass(status: string): string {
  if (status === 'delivered') return 'wo-status wo-status--success';
  if (status === 'rejected' || status === 'cancelled') return 'wo-status wo-status--danger';
  if (status === 'paid' || status === 'shipped') return 'wo-status wo-status--info';
  if (status === 'accepted') return 'wo-status wo-status--accepted';
  return 'wo-status wo-status--pending';
}

export default function WholesalerOrders() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrgOrders();
      setOrders(data);
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : 'Impossible de charger les commandes';
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

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  const handleAction = async (orderId: string, status: 'accepted' | 'rejected' | 'shipped' | 'delivered') => {
    setActionId(orderId);
    setActionError(null);
    try {
      await updateOrderStatus(orderId, status);
      await loadOrders();
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : 'Action impossible';
      setActionError(message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="wo-page" data-testid="wholesaler-orders">
      {/* ── Title ───────────────────────────────────── */}
      <header className="wo-header">
        <div>
          <h1 className="wo-title">
            Commandes
            {pendingCount > 0 && (
              <span className="wo-pending-badge" data-testid="wo-pending-badge">{pendingCount}</span>
            )}
          </h1>
        </div>
      </header>

      {/* ── Filter Tabs ─────────────────────────────── */}
      <nav className="wo-filters" data-testid="wo-filters">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`wo-filter-btn ${filter === opt.value ? 'wo-filter-btn--active' : ''}`}
            data-testid={`wo-filter-${opt.value}`}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
            {opt.value !== 'all' && (
              <span className="wo-filter-count">
                {orders.filter(o => o.status === opt.value).length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Action Error ────────────────────────────── */}
      {actionError && (
        <div className="wo-action-error" data-testid="wo-action-error">
          {actionError}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────── */}
      {loading && (
        <div className="wo-loading" data-testid="wo-loading">
          <div className="wo-spinner" />
          <span>Chargement…</span>
        </div>
      )}

      {/* ── Error ───────────────────────────────────── */}
      {error && !loading && (
        <div className="wo-error" data-testid="wo-error">
          <p>{error}</p>
          <button className="wo-retry-btn" data-testid="wo-retry-btn" onClick={() => void loadOrders()}>
            Réessayer
          </button>
        </div>
      )}

      {/* ── Empty ───────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="wo-empty" data-testid="wo-empty">
          <p>
            {filter === 'all'
              ? 'Aucune commande reçue pour le moment.'
              : `Aucune commande « ${STATUS_LABELS[filter] ?? filter} ».`}
          </p>
        </div>
      )}

      {/* ── Order List ──────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="wo-list" data-testid="wo-list">
          {filtered.map(order => (
            <div key={order.id} className="wo-card" data-testid="wo-card">
              <div className="wo-card-top">
                <span className="wo-order-id">#{order.id.slice(0, 8)}</span>
                <span className={statusClass(order.status)}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>

              <div className="wo-card-mid">
                <span className="wo-total">{formatXOF(order.total_xof)}</span>
                <span className="wo-date">
                  {new Date(order.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {order.items && order.items.length > 0 && (
                <div className="wo-items">
                  {order.items.map(item => (
                    <div key={item.id} className="wo-item-row">
                      <span className="wo-item-qty">{item.quantity}×</span>
                      <span className="wo-item-price">{formatXOF(item.unit_price_xof)}</span>
                      <span className="wo-item-line">{formatXOF(item.line_total_xof)}</span>
                    </div>
                  ))}
                </div>
              )}

              <Link
                to={`/wholesaler/orders/${order.id}`}
                className="wo-detail-link"
                data-testid="wo-detail-link"
              >
                Voir détail →
              </Link>

              {order.status === 'pending' && (
                <div className="wo-card-actions">
                  <button
                    className="wo-action-btn wo-action-btn--accept"
                    data-testid="wo-accept-btn"
                    disabled={actionId === order.id}
                    onClick={() => void handleAction(order.id, 'accepted')}
                  >
                    {actionId === order.id ? '…' : 'Accepter'}
                  </button>
                  <button
                    className="wo-action-btn wo-action-btn--reject"
                    data-testid="wo-reject-btn"
                    disabled={actionId === order.id}
                    onClick={() => void handleAction(order.id, 'rejected')}
                  >
                    {actionId === order.id ? '…' : 'Refuser'}
                  </button>
                </div>
              )}

              {order.status === 'paid' && (
                <div className="wo-card-actions">
                  <button
                    className="wo-action-btn wo-action-btn--accept"
                    data-testid="wo-ship-btn"
                    disabled={actionId === order.id}
                    onClick={() => void handleAction(order.id, 'shipped')}
                  >
                    {actionId === order.id ? '…' : 'Marquer expédiée'}
                  </button>
                </div>
              )}

              {order.status === 'shipped' && (
                <div className="wo-card-actions">
                  <button
                    className="wo-action-btn wo-action-btn--accept"
                    data-testid="wo-deliver-btn"
                    disabled={actionId === order.id}
                    onClick={() => void handleAction(order.id, 'delivered')}
                  >
                    {actionId === order.id ? '…' : 'Marquer livrée'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
