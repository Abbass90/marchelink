import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { fetchMyOrders, ApiError } from '../api/client.js';
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

function statusClass(status: string): string {
  if (status === 'delivered') return 'bd-status bd-status--success';
  if (status === 'cancelled') return 'bd-status bd-status--danger';
  if (status === 'paid' || status === 'shipped') return 'bd-status bd-status--info';
  return 'bd-status bd-status--pending';
}

export default function BuyerDashboard() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const navigate = useNavigate();
  const pendingCount = orders.filter(o => o.status === 'pending' || o.status === 'accepted').length;
  const activeCount = orders.filter(o => o.status === 'paid' || o.status === 'shipped').length;
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="bd-page" data-testid="buyer-dashboard">
      {/* ── Greeting ──────────────────────────────────── */}
      <div className="bd-greeting-row">
        <p className="bd-greeting" data-testid="bd-greeting">
          Bonjour, {user?.first_name} {user?.last_name}
        </p>
      </div>

      {/* ── Stats Row ───────────────────────────────── */}
      <section className="bd-stats" data-testid="bd-stats">
        <div className="bd-stat-card">
          <span className="bd-stat-value" data-testid="bd-total-orders">{orders.length}</span>
          <span className="bd-stat-label">Commandes</span>
        </div>
        <div className="bd-stat-card bd-stat-card--warn">
          <span className="bd-stat-value" data-testid="bd-pending-count">{pendingCount}</span>
          <span className="bd-stat-label">En attente</span>
        </div>
        <div className="bd-stat-card bd-stat-card--info">
          <span className="bd-stat-value" data-testid="bd-active-count">{activeCount}</span>
          <span className="bd-stat-label">En cours</span>
        </div>
      </section>

      {/* ── Recent Orders ───────────────────────────── */}
      <section className="bd-orders-section">
        <h2 className="bd-section-title">Commandes récentes</h2>

        {loading && (
          <div className="bd-loading" data-testid="bd-loading">
            <div className="bd-spinner" />
            <span>Chargement de vos commandes…</span>
          </div>
        )}

        {error && !loading && (
          <div className="bd-error" data-testid="bd-error">
            <p>{error}</p>
            <button className="bd-retry-btn" data-testid="bd-retry-btn" onClick={() => void loadOrders()}>
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="bd-empty" data-testid="bd-empty">
            <p>Vous n'avez pas encore passé de commande.</p>
          </div>
        )}

        {!loading && !error && recentOrders.length > 0 && (
          <div className="bd-order-list" data-testid="bd-order-list">
            {recentOrders.map(order => (
              <div
                key={order.id}
                className="bd-order-card"
                data-testid="bd-order-card"
                tabIndex={0}
                onClick={() => navigate(`/buyer/order-confirmation/${order.id}`)}
                onKeyDown={e => { if (e.key === 'Enter') navigate(`/buyer/order-confirmation/${order.id}`); }}
              >
                <div className="bd-order-top">
                  <span className="bd-order-id">#{order.id.slice(0, 8)}</span>
                  <span className={statusClass(order.status)}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
                <div className="bd-order-bottom">
                  <span className="bd-order-total">{formatXOF(order.total_xof)}</span>
                  <span className="bd-order-date">
                    {new Date(order.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                {order.status === 'pending' && (
                  <button
                    className="bd-pay-link"
                    data-testid="bd-pay-link"
                    onClick={e => { e.stopPropagation(); navigate(`/buyer/pay/${order.id}`); }}
                  >
                    Payer maintenant →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
