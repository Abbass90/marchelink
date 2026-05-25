import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchAvailableDeliveries,
  fetchMyDeliveries,
  acceptDelivery,
  completeDelivery,
  type AvailableOrder,
  type DeliveryResponse,
} from '../api/client.js';
import '../components/primitives/catalog.css';

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Tab = 'available' | 'mine';
type LoadState = 'loading' | 'error' | 'success';

export default function DeliveryDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  const viewParam = searchParams.get('view');
  const activeTab: Tab = viewParam === 'mine' ? 'mine' : 'available';

  function setActiveTab(tab: Tab) {
    setSearchParams({ view: tab }, { replace: true });
  }

  const [availState, setAvailState] = useState<LoadState>('loading');
  const [availOrders, setAvailOrders] = useState<AvailableOrder[]>([]);
  const [availError, setAvailError] = useState('');

  const [mineState, setMineState] = useState<LoadState>('loading');
  const [myDeliveries, setMyDeliveries] = useState<DeliveryResponse[]>([]);
  const [mineError, setMineError] = useState('');

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const loadAvailable = useCallback(async () => {
    setAvailState('loading');
    setAvailError('');
    try {
      const data = await fetchAvailableDeliveries();
      setAvailOrders(data);
      setAvailState('success');
    } catch (err: unknown) {
      setAvailError(err instanceof Error ? err.message : 'Erreur inconnue');
      setAvailState('error');
    }
  }, []);

  const loadMine = useCallback(async () => {
    setMineState('loading');
    setMineError('');
    try {
      const data = await fetchMyDeliveries();
      setMyDeliveries(data);
      setMineState('success');
    } catch (err: unknown) {
      setMineError(err instanceof Error ? err.message : 'Erreur inconnue');
      setMineState('error');
    }
  }, []);

  useEffect(() => {
    void loadAvailable();
    void loadMine();
  }, [loadAvailable, loadMine]);

  async function handleAccept(orderId: string) {
    setAcceptingId(orderId);
    setAcceptError(null);
    try {
      await acceptDelivery(orderId);
      await Promise.all([loadAvailable(), loadMine()]);
      setActiveTab('mine');
    } catch (err: unknown) {
      setAcceptError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleComplete(deliveryId: string) {
    setCompletingId(deliveryId);
    setCompleteError(null);
    try {
      await completeDelivery(deliveryId);
      await loadMine();
    } catch (err: unknown) {
      setCompleteError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setCompletingId(null);
    }
  }

  function statusLabel(status: string): { text: string; cls: string } {
    switch (status) {
      case 'assigned':
        return { text: 'En cours', cls: 'del-status--assigned' };
      case 'delivered':
        return { text: 'Livré', cls: 'del-status--delivered' };
      default:
        return { text: status, cls: '' };
    }
  }

  const activeDeliveries = myDeliveries.filter((d) => d.status === 'assigned');
  const completedDeliveries = myDeliveries.filter((d) => d.status === 'delivered');

  return (
    <div className="catalog-page" data-testid="delivery-dashboard">
      <div className="catalog-container del-container">
        {/* Tabs */}
        <nav className="del-tabs" data-testid="del-tabs">
          <button
            className={`del-tab ${activeTab === 'available' ? 'del-tab--active' : ''}`}
            data-testid="del-tab-available"
            onClick={() => setActiveTab('available')}
          >
            Livraisons Disponibles
            {availState === 'success' && availOrders.length > 0 && (
              <span className="del-tab-badge" data-testid="del-avail-count">{availOrders.length}</span>
            )}
          </button>
          <button
            className={`del-tab ${activeTab === 'mine' ? 'del-tab--active' : ''}`}
            data-testid="del-tab-mine"
            onClick={() => setActiveTab('mine')}
          >
            Mes Courses
            {mineState === 'success' && activeDeliveries.length > 0 && (
              <span className="del-tab-badge" data-testid="del-mine-count">{activeDeliveries.length}</span>
            )}
          </button>
        </nav>

        {/* ── Tab: Available Deliveries ──────────────── */}
        {activeTab === 'available' && (
          <section data-testid="del-available-section">
            {acceptError && (
              <div className="ws-error-banner" data-testid="del-accept-error">
                {acceptError}
              </div>
            )}

            {availState === 'loading' && (
              <div className="del-loading" data-testid="del-avail-loading">
                <div className="ws-spinner" />
                <p className="ws-loading-text">Recherche de livraisons…</p>
              </div>
            )}

            {availState === 'error' && (
              <div className="ws-error-card" data-testid="del-avail-error">
                <p className="ws-error-msg">{availError}</p>
                <button
                  className="ws-btn ws-btn--primary"
                  data-testid="del-avail-retry"
                  onClick={() => void loadAvailable()}
                >
                  Réessayer
                </button>
              </div>
            )}

            {availState === 'success' && availOrders.length === 0 && (
              <div className="del-empty" data-testid="del-avail-empty">
                <span className="del-empty-icon" aria-hidden="true">🚗</span>
                <p className="del-empty-text">Aucune livraison disponible pour le moment.</p>
                <button
                  className="ws-btn ws-btn--secondary"
                  data-testid="del-avail-refresh"
                  onClick={() => void loadAvailable()}
                >
                  Actualiser
                </button>
              </div>
            )}

            {availState === 'success' && availOrders.length > 0 && (
              <ul className="del-list" data-testid="del-avail-list">
                {availOrders.map((order) => (
                  <li key={order.id} className="del-card" data-testid="del-avail-card">
                    <div className="del-card-header">
                      <span className="del-card-id" data-testid="del-order-id">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="del-card-date">{formatDate(order.created_at)}</span>
                    </div>
                    <div className="del-card-body">
                      <div className="del-card-row">
                        <span className="del-card-label">Montant</span>
                        <span className="del-card-value del-card-amount" data-testid="del-order-amount">
                          {formatXOF(order.total_xof)}
                        </span>
                      </div>
                    </div>
                    <button
                      className="ws-btn ws-btn--primary del-accept-btn"
                      data-testid="del-accept-btn"
                      disabled={acceptingId === order.id}
                      onClick={() => void handleAccept(order.id)}
                    >
                      {acceptingId === order.id ? (
                        <span className="del-btn-loading">
                          <span className="del-btn-spinner" />
                          Acceptation…
                        </span>
                      ) : (
                        'Accepter la course'
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Tab: My Deliveries ─────────────────────── */}
        {activeTab === 'mine' && (
          <section data-testid="del-mine-section">
            {completeError && (
              <div className="ws-error-banner" data-testid="del-complete-error">
                {completeError}
              </div>
            )}

            {mineState === 'loading' && (
              <div className="del-loading" data-testid="del-mine-loading">
                <div className="ws-spinner" />
                <p className="ws-loading-text">Chargement de vos courses…</p>
              </div>
            )}

            {mineState === 'error' && (
              <div className="ws-error-card" data-testid="del-mine-error">
                <p className="ws-error-msg">{mineError}</p>
                <button
                  className="ws-btn ws-btn--primary"
                  data-testid="del-mine-retry"
                  onClick={() => void loadMine()}
                >
                  Réessayer
                </button>
              </div>
            )}

            {mineState === 'success' && myDeliveries.length === 0 && (
              <div className="del-empty" data-testid="del-mine-empty">
                <span className="del-empty-icon" aria-hidden="true">📋</span>
                <p className="del-empty-text">Vous n&apos;avez aucune course pour le moment.</p>
              </div>
            )}

            {mineState === 'success' && myDeliveries.length > 0 && (
              <>
                {activeDeliveries.length > 0 && (
                  <div data-testid="del-active-group">
                    <h2 className="del-section-label">En cours ({activeDeliveries.length})</h2>
                    <ul className="del-list">
                      {activeDeliveries.map((d) => {
                        const st = statusLabel(d.status);
                        return (
                          <li key={d.id} className="del-card del-card--active" data-testid="del-mine-card">
                            <div className="del-card-header">
                              <span className="del-card-id" data-testid="del-delivery-id">
                                #{d.id.slice(0, 8).toUpperCase()}
                              </span>
                              <span className={`del-status-badge ${st.cls}`} data-testid="del-status">
                                {st.text}
                              </span>
                            </div>
                            <div className="del-card-body">
                              <div className="del-card-row">
                                <span className="del-card-label">Commande</span>
                                <span className="del-card-value" data-testid="del-mine-order-id">
                                  #{d.order_id.slice(0, 8).toUpperCase()}
                                </span>
                              </div>
                              <div className="del-card-row">
                                <span className="del-card-label">Assignée le</span>
                                <span className="del-card-value">{formatDate(d.created_at)}</span>
                              </div>
                            </div>
                            <button
                              className="ws-btn ws-btn--primary del-complete-btn"
                              data-testid="del-complete-btn"
                              disabled={completingId === d.id}
                              onClick={() => void handleComplete(d.id)}
                            >
                              {completingId === d.id ? (
                                <span className="del-btn-loading">
                                  <span className="del-btn-spinner" />
                                  Confirmation…
                                </span>
                              ) : (
                                'Marquer comme Livré'
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {completedDeliveries.length > 0 && (
                  <div data-testid="del-completed-group">
                    <h2 className="del-section-label del-section-label--muted">
                      Livrées ({completedDeliveries.length})
                    </h2>
                    <ul className="del-list">
                      {completedDeliveries.map((d) => {
                        const st = statusLabel(d.status);
                        return (
                          <li key={d.id} className="del-card del-card--completed" data-testid="del-completed-card">
                            <div className="del-card-header">
                              <span className="del-card-id">
                                #{d.id.slice(0, 8).toUpperCase()}
                              </span>
                              <span className={`del-status-badge ${st.cls}`} data-testid="del-completed-status">
                                {st.text}
                              </span>
                            </div>
                            <div className="del-card-body">
                              <div className="del-card-row">
                                <span className="del-card-label">Commande</span>
                                <span className="del-card-value">
                                  #{d.order_id.slice(0, 8).toUpperCase()}
                                </span>
                              </div>
                              {d.completed_at && (
                                <div className="del-card-row">
                                  <span className="del-card-label">Livrée le</span>
                                  <span className="del-card-value">{formatDate(d.completed_at)}</span>
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
