import { useState, useEffect, useCallback } from 'react';
import { Banknote, Package, Clock, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import {
  fetchDashboardStats,
  updateProduct,
  type DashboardStats,
  type LowStockProduct,
} from '../api/client.js';
import '../components/primitives/catalog.css';

function formatXOF(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' F';
}

type LoadState = 'loading' | 'error' | 'success';

export default function WholesalerDashboard() {
  const { user } = useAuth();

  const [state, setState] = useState<LoadState>('loading');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStats = useCallback(async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const data = await fetchDashboardStats();
      setStats(data);
      setState('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setErrorMsg(msg);
      setState('error');
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  function handleEditStock(product: LowStockProduct) {
    setEditingId(product.id);
    setEditQty(String(product.stock_qty));
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditQty('');
  }

  async function handleSaveStock(productId: string) {
    const qty = Number(editQty);
    if (!Number.isInteger(qty) || qty < 0) return;
    setSaving(true);
    try {
      await updateProduct(productId, { stock_qty: qty });
      await loadStats();
      setEditingId(null);
      setEditQty('');
    } catch {
      /* silent — error is minor in quick-action context */
    } finally {
      setSaving(false);
    }
  }

  if (state === 'loading') {
    return (
      <div className="catalog-page" data-testid="wholesaler-dashboard">
        <div className="catalog-container ws-container">
          <div className="ws-loading" data-testid="ws-loading">
            <div className="ws-spinner" />
            <p className="ws-loading-text">Chargement du tableau de bord…</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="catalog-page" data-testid="wholesaler-dashboard">
        <div className="catalog-container ws-container">
          <div className="ws-error-card" data-testid="ws-error">
            <p className="ws-error-msg">{errorMsg}</p>
            <button
              className="ws-btn ws-btn--primary"
              data-testid="ws-retry-btn"
              onClick={() => void loadStats()}
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-page" data-testid="wholesaler-dashboard">
      <div className="catalog-container ws-container">
        {/* Title */}
        <header className="ws-header">
          <div className="ws-header-left">
            <h1 className="ws-title" data-testid="ws-title">Tableau de bord</h1>
            <p className="ws-subtitle">
              Bienvenue, {user?.first_name} {user?.last_name}
            </p>
          </div>
        </header>

        {/* KPI Cards */}
        <section className="ws-kpi-grid" data-testid="ws-kpi-grid">
          <div className="ws-kpi-card" data-testid="ws-kpi-revenue">
            <span className="ws-kpi-icon" aria-hidden="true"><Banknote size={22} /></span>
            <span className="ws-kpi-value" data-testid="ws-revenue-value">
              {formatXOF(stats!.revenue_today_xof)}
            </span>
            <span className="ws-kpi-label">Revenu aujourd&apos;hui</span>
          </div>

          <div className="ws-kpi-card" data-testid="ws-kpi-orders">
            <span className="ws-kpi-icon" aria-hidden="true"><Package size={22} /></span>
            <span className="ws-kpi-value" data-testid="ws-orders-value">
              {stats!.orders_today}
            </span>
            <span className="ws-kpi-label">Commandes du jour</span>
          </div>

          <div className="ws-kpi-card ws-kpi-card--alert" data-testid="ws-kpi-pending">
            <span className="ws-kpi-icon" aria-hidden="true"><Clock size={22} /></span>
            <span className="ws-kpi-value" data-testid="ws-pending-value">
              {stats!.orders_pending}
            </span>
            <span className="ws-kpi-label">En attente de validation</span>
          </div>
        </section>

        {/* Low Stock Alerts */}
        <section className="ws-alerts" data-testid="ws-stock-alerts">
          <h2 className="ws-section-title">
            Alertes stock
            {stats!.low_stock_products.length > 0 && (
              <span className="ws-badge ws-badge--danger" data-testid="ws-alert-count">
                {stats!.low_stock_products.length}
              </span>
            )}
          </h2>

          {stats!.low_stock_products.length === 0 ? (
            <div className="ws-empty-alerts" data-testid="ws-no-alerts">
              <p>Aucun produit en stock critique. Tout va bien !</p>
            </div>
          ) : (
            <ul className="ws-alert-list">
              {stats!.low_stock_products.map((p) => (
                <li key={p.id} className="ws-alert-item" data-testid="ws-alert-item">
                  <div className="ws-alert-info">
                    <span className="ws-alert-name">{p.name}</span>
                    <span className="ws-alert-sku">{p.sku}</span>
                  </div>

                  {editingId === p.id ? (
                    <div className="ws-alert-edit" data-testid="ws-stock-edit">
                      <input
                        type="number"
                        className="ws-stock-input"
                        data-testid="ws-stock-input"
                        value={editQty}
                        min={0}
                        onChange={(e) => setEditQty(e.target.value)}
                        disabled={saving}
                      />
                      <button
                        className="ws-btn ws-btn--sm ws-btn--primary"
                        data-testid="ws-stock-save"
                        disabled={saving}
                        onClick={() => void handleSaveStock(p.id)}
                      >
                        {saving ? '…' : 'OK'}
                      </button>
                      <button
                        className="ws-btn ws-btn--sm ws-btn--secondary"
                        data-testid="ws-stock-cancel"
                        disabled={saving}
                        onClick={handleCancelEdit}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="ws-alert-actions">
                      <span
                        className={`ws-stock-badge ${p.stock_qty === 0 ? 'ws-stock-badge--zero' : 'ws-stock-badge--low'}`}
                        data-testid="ws-stock-qty"
                      >
                        {p.stock_qty} unités
                      </span>
                      <button
                        className="ws-btn ws-btn--sm ws-btn--ghost"
                        data-testid="ws-adjust-btn"
                        onClick={() => handleEditStock(p)}
                      >
                        Ajuster
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
