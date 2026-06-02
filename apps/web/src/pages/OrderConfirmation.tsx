import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { Clock, Check, CreditCard, Truck, CheckCircle2, Ban, XCircle } from 'lucide-react';
import OrderTimeline from '../components/features/OrderTimeline.js';
import { fetchOrderTimeline, fetchOrderForBuyer } from '../api/client.js';
import type { OrderResponse } from '../api/client.js';
import { SWIFTGO_URL } from '../config/site.js';
import '../components/primitives/catalog.css';

/* ── XOF formatter ───────────────────────────────────── */

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

/* ── Status configuration ────────────────────────────── */

interface StatusConfig {
  icon: ReactNode;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusClass: string;
  showPayButton: boolean;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  pending: {
    icon: <Clock size={48} />,
    title: 'Commande enregistrée',
    subtitle: 'Votre commande a été transmise au grossiste. En attente de validation.',
    statusLabel: 'En attente de validation',
    statusClass: 'confirmation-status--pending',
    showPayButton: false,
  },
  accepted: {
    icon: <Check size={48} />,
    title: 'Commande acceptée',
    subtitle: 'Le grossiste a accepté votre commande. Vous pouvez procéder au paiement.',
    statusLabel: 'Acceptée — Prête à payer',
    statusClass: 'confirmation-status--accepted',
    showPayButton: true,
  },
  paid: {
    icon: <CreditCard size={48} />,
    title: 'Paiement confirmé',
    subtitle: 'Votre paiement a été reçu. La commande est en préparation.',
    statusLabel: 'Payée — En préparation',
    statusClass: 'confirmation-status--paid',
    showPayButton: false,
  },
  shipped: {
    icon: <Truck size={48} />,
    title: 'Commande expédiée',
    subtitle: 'Votre commande est en cours de livraison.',
    statusLabel: 'En cours de livraison',
    statusClass: 'confirmation-status--shipped',
    showPayButton: false,
  },
  delivered: {
    icon: <CheckCircle2 size={48} />,
    title: 'Commande livrée',
    subtitle: 'Votre commande a été livrée avec succès.',
    statusLabel: 'Livrée',
    statusClass: 'confirmation-status--delivered',
    showPayButton: false,
  },
  cancelled: {
    icon: <Ban size={48} />,
    title: 'Commande annulée',
    subtitle: 'Cette commande a été annulée.',
    statusLabel: 'Annulée',
    statusClass: 'confirmation-status--cancelled',
    showPayButton: false,
  },
  rejected: {
    icon: <XCircle size={48} />,
    title: 'Commande refusée',
    subtitle: 'Le grossiste a refusé cette commande.',
    statusLabel: 'Refusée',
    statusClass: 'confirmation-status--rejected',
    showPayButton: false,
  },
};

const DEFAULT_CONFIG: StatusConfig = {
  icon: <Check size={48} />,
  title: 'Commande enregistrée',
  subtitle: 'Votre commande a été transmise au grossiste.',
  statusLabel: 'En attente de validation',
  statusClass: 'confirmation-status--pending',
  showPayButton: false,
};

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
  const totalXofFromState = state.totalXof ?? null;

  /* ── Fetch real order data ─────────────────────────── */
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(orderId !== 'N/A');
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (orderId === 'N/A') return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrderForBuyer(orderId);
      setOrder(data);
    } catch {
      // Silently fall back to default pending display
      setError('Impossible de charger le statut');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  /* ── Derive display values ─────────────────────────── */
  const currentStatus = order?.status ?? 'pending';
  const config = STATUS_MAP[currentStatus] ?? DEFAULT_CONFIG;
  const totalXof = order?.total_xof ?? totalXofFromState;

  /* ── Loading state (CLAUDE.md §30 — Three-state rule) */
  if (loading) {
    return (
      <div className="catalog-page" data-testid="confirmation-page">
        <div className="catalog-container">
          <div className="confirmation-card" data-testid="confirmation-card">
            <div className="confirmation-skeleton" data-testid="confirmation-loading">
              <div className="skeleton-circle" />
              <div className="skeleton-line skeleton-line--lg" />
              <div className="skeleton-line skeleton-line--md" />
              <div className="skeleton-line skeleton-line--sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-page" data-testid="confirmation-page">
      <div className="catalog-container">
        <div className="confirmation-card" data-testid="confirmation-card">
          <div className="confirmation-icon" aria-hidden="true">
            {config.icon}
          </div>

          <h1 className="confirmation-title" data-testid="confirmation-title">
            {config.title}
          </h1>

          <p className="confirmation-subtitle">
            {config.subtitle}
          </p>

          {error && (
            <p className="confirmation-error" data-testid="confirmation-error">
              {error}
              <button
                type="button"
                className="confirmation-retry-btn"
                onClick={loadOrder}
                data-testid="confirmation-retry"
              >
                R&eacute;essayer
              </button>
            </p>
          )}

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
              <span
                className={`confirmation-value confirmation-status ${config.statusClass}`}
                data-testid="confirmation-status"
              >
                {config.statusLabel}
              </span>
            </div>
            {order?.delivery_mode && (
              <div className="confirmation-row">
                <span className="confirmation-label">Livraison</span>
                {order.delivery_mode === 'swiftgo' ? (
                  <a
                    href={SWIFTGO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="confirmation-value confirmation-swiftgo-link"
                    data-testid="confirmation-swiftgo-link"
                  >
                    SwiftGo ↗
                  </a>
                ) : (
                  <span className="confirmation-value" data-testid="confirmation-delivery-mode">
                    Livraison grossiste
                  </span>
                )}
              </div>
            )}
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
            {config.showPayButton && (
              <Link
                to={`/buyer/pay/${orderId}`}
                className="confirmation-btn confirmation-btn--primary"
                data-testid="confirmation-pay-link"
              >
                Payer maintenant
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
