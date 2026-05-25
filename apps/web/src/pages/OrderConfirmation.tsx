import { Link, useParams, useLocation } from 'react-router-dom';
import OrderTimeline from '../components/features/OrderTimeline.js';
import { fetchOrderTimeline } from '../api/client.js';
import '../components/primitives/catalog.css';

/* ── XOF formatter ───────────────────────────────────── */

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

/* ── Component ───────────────────────────────────────── */

interface LocationState {
  orderId?: string | undefined;
  totalXof?: string | undefined;
}

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const orderId = id ?? state.orderId ?? 'N/A';
  const totalXof = state.totalXof ?? null;

  return (
    <div className="catalog-page" data-testid="confirmation-page">
      <div className="catalog-container">
        <div className="confirmation-card" data-testid="confirmation-card">
          <div className="confirmation-icon" aria-hidden="true">
            &#10003;
          </div>

          <h1 className="confirmation-title" data-testid="confirmation-title">
            Commande enregistrée !
          </h1>

          <p className="confirmation-subtitle">
            Votre commande a été transmise au grossiste.
          </p>

          <div className="confirmation-details">
            <div className="confirmation-row">
              <span className="confirmation-label">N&deg; commande</span>
              <span className="confirmation-value" data-testid="confirmation-order-id">
                {orderId.slice(0, 8).toUpperCase()}
              </span>
            </div>
            {totalXof && (
              <div className="confirmation-row">
                <span className="confirmation-label">Montant total</span>
                <span className="confirmation-value" data-testid="confirmation-total">
                  {formatXOF(totalXof)}
                </span>
              </div>
            )}
            <div className="confirmation-row">
              <span className="confirmation-label">Statut</span>
              <span className="confirmation-value confirmation-status">
                En attente de validation
              </span>
            </div>
          </div>

          {orderId !== 'N/A' && (
            <OrderTimeline orderId={orderId} fetchFn={fetchOrderTimeline} />
          )}

          <div className="confirmation-actions">
            <Link
              to="/buyer/catalog"
              className="confirmation-btn confirmation-btn--secondary"
              data-testid="confirmation-catalog-link"
            >
              Continuer les achats
            </Link>
            <Link
              to={`/buyer/pay/${orderId}`}
              className="confirmation-btn confirmation-btn--primary"
              data-testid="confirmation-pay-link"
            >
              Payer maintenant
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
