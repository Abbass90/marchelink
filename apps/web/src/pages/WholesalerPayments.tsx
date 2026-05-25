import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrgPayments, ApiError } from '../api/client.js';
import type { PaymentResponse } from '../api/client.js';
import '../components/primitives/catalog.css';

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  completed: 'Complété',
  failed: 'Échoué',
};

function statusClass(status: string): string {
  if (status === 'completed') return 'wo-status wo-status--success';
  if (status === 'failed') return 'wo-status wo-status--danger';
  return 'wo-status wo-status--pending';
}

export default function WholesalerPayments() {
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrgPayments();
      setPayments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les paiements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="wo-page" data-testid="wholesaler-payments">
      <header className="wo-header">
        <h1 className="wo-title">Paiements Reçus</h1>
      </header>

      {loading && (
        <div className="wo-loading" data-testid="wp-loading">
          <div className="wo-spinner" />
          <span>Chargement…</span>
        </div>
      )}

      {error && !loading && (
        <div className="wo-error" data-testid="wp-error">
          <p>{error}</p>
          <button
            className="wo-retry-btn"
            data-testid="wp-retry"
            onClick={() => void load()}
          >
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && payments.length === 0 && (
        <div className="wo-empty" data-testid="wp-empty">
          <p>Aucun paiement reçu pour le moment.</p>
        </div>
      )}

      {!loading && !error && payments.length > 0 && (
        <div className="wo-list" data-testid="wp-list">
          {payments.map((p) => (
            <div key={p.id} className="wo-card" data-testid="wp-card">
              <div className="wo-card-top">
                <span className="wo-total">{formatXOF(p.amount_xof)}</span>
                <span className={statusClass(p.status)}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
              <div className="wo-card-mid">
                <span className="wo-date">
                  {new Date(p.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
                {p.provider_ref && (
                  <span className="wo-item-price">Réf : {p.provider_ref}</span>
                )}
              </div>
              <Link
                to={`/wholesaler/orders/${p.order_id}`}
                className="wo-detail-link"
                data-testid="wp-order-link"
              >
                Voir commande →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
