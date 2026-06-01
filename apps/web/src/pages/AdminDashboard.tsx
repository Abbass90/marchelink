import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import {
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminOrgs,
  fetchAdminOrders,
  type PlatformStats,
  type AdminUser,
  type AdminOrg,
  type AdminOrder,
} from '../api/client.js';
import '../components/primitives/catalog.css';

function formatXOF(amount: number | string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Admin',
  wholesaler_admin: 'Grossiste',
  wholesaler_seller: 'Vendeur',
  buyer: 'Acheteur',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
  paid: 'Payée',
  shipped: 'En livraison',
  delivered: 'Livrée',
};

const ORG_STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  pending: 'En attente',
};

type Tab = 'overview' | 'users' | 'orgs' | 'orders';
type LoadState = 'loading' | 'error' | 'success';

export default function AdminDashboard() {
  const { logout } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  const loadAll = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const [s, u, o, ord] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(),
        fetchAdminOrgs(),
        fetchAdminOrders(),
      ]);
      setStats(s);
      setUsers(u);
      setOrgs(o);
      setOrders(ord);
      setState('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /* ── Loading ──────────────────────────────────────────── */
  if (state === 'loading') {
    return (
      <div className="catalog-page" data-testid="admin-dashboard">
        <div className="catalog-container adm-container">
          <div className="ws-loading" data-testid="adm-loading">
            <div className="ws-spinner" />
            <p className="ws-loading-text">Chargement…</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────── */
  if (state === 'error') {
    return (
      <div className="catalog-page" data-testid="admin-dashboard">
        <div className="catalog-container adm-container">
          <div className="ws-error-card" data-testid="adm-error">
            <p className="ws-error-msg">{error}</p>
            <button className="ws-btn ws-btn--primary" data-testid="adm-retry" onClick={() => void loadAll()}>
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Success ──────────────────────────────────────────── */
  return (
    <div className="catalog-page" data-testid="admin-dashboard">
      <div className="catalog-container adm-container">
        {/* Header */}
        <header className="adm-header">
          <div>
            <h1 className="adm-title" data-testid="adm-title">Administration</h1>
            <p className="adm-subtitle">Plateforme MarchéLink</p>
          </div>
          <button
            className="ws-btn ws-btn--secondary"
            data-testid="adm-logout"
            onClick={() => void logout()}
          >
            Déconnexion
          </button>
        </header>

        {/* Tabs */}
        <nav className="adm-tabs" data-testid="adm-tabs">
          {([
            ['overview', 'Vue d\'ensemble'],
            ['users', `Utilisateurs (${users.length})`],
            ['orgs', `Organisations (${orgs.length})`],
            ['orders', `Commandes (${orders.length})`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`adm-tab ${tab === key ? 'adm-tab--active' : ''}`}
              data-testid={`adm-tab-${key}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── Tab: Overview ─────────────────────────────── */}
        {tab === 'overview' && stats && (
          <section data-testid="adm-overview">
            <div className="adm-kpi-grid">
              <div className="adm-kpi" data-testid="adm-kpi-users">
                <span className="adm-kpi-value">{stats.total_users}</span>
                <span className="adm-kpi-label">Utilisateurs</span>
              </div>
              <div className="adm-kpi" data-testid="adm-kpi-orgs">
                <span className="adm-kpi-value">{stats.total_organizations}</span>
                <span className="adm-kpi-label">Organisations</span>
              </div>
              <div className="adm-kpi" data-testid="adm-kpi-orders">
                <span className="adm-kpi-value">{stats.total_orders}</span>
                <span className="adm-kpi-label">Commandes</span>
              </div>
              <div className="adm-kpi" data-testid="adm-kpi-revenue">
                <span className="adm-kpi-value">{formatXOF(stats.total_revenue_xof)}</span>
                <span className="adm-kpi-label">Revenu total</span>
              </div>
            </div>

            {Object.keys(stats.orders_by_status).length > 0 && (
              <div className="adm-status-grid" data-testid="adm-status-breakdown">
                <h2 className="adm-section-title">Répartition des commandes</h2>
                <div className="adm-status-cards">
                  {Object.entries(stats.orders_by_status).map(([status, count]) => (
                    <div key={status} className={`adm-status-card adm-status-card--${status}`}>
                      <span className="adm-status-count">{count}</span>
                      <span className="adm-status-label">{STATUS_LABELS[status] ?? status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Tab: Users ────────────────────────────────── */}
        {tab === 'users' && (
          <section data-testid="adm-users">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Organisation</th>
                    <th>Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} data-testid="adm-user-row">
                      <td className="adm-cell-name">{u.first_name} {u.last_name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`adm-role-badge adm-role-badge--${u.role}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td>{u.org_name ?? '—'}</td>
                      <td>{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Tab: Organizations ─────────────────────────── */}
        {tab === 'orgs' && (
          <section data-testid="adm-orgs">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Statut</th>
                    <th>Membres</th>
                    <th>Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map(o => (
                    <tr key={o.id} data-testid="adm-org-row">
                      <td className="adm-cell-name">{o.name}</td>
                      <td>
                        <span className={`adm-org-status adm-org-status--${o.status}`}>
                          {ORG_STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </td>
                      <td>{o.user_count}</td>
                      <td>{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Tab: Orders ───────────────────────────────── */}
        {tab === 'orders' && (
          <section data-testid="adm-orders">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Acheteur</th>
                    <th>Grossiste</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} data-testid="adm-order-row">
                      <td className="adm-cell-id">#{o.id.slice(0, 8)}</td>
                      <td>{o.buyer_name}</td>
                      <td>{o.org_name}</td>
                      <td className="adm-cell-amount">{formatXOF(o.total_xof)}</td>
                      <td>
                        <span className={`adm-order-status adm-order-status--${o.status}`}>
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </td>
                      <td>{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
