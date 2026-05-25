import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  fetchOrderForBuyer,
  initiatePayment,
  simulateWebhook,
  ApiError,
} from '../api/client.js';
import type { OrderResponse, PaymentResponse } from '../api/client.js';
import '../components/primitives/catalog.css';
import '../components/primitives/auth.css';

/* ── XOF formatter ───────────────────────────────────── */

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

/* ── Operators ──────────────────────────────────────── */

interface Operator {
  id: string;
  name: string;
  color: string;
  icon: string;
}

const OPERATORS: Operator[] = [
  { id: 'orange_money', name: 'Orange Money', color: '#FF6600', icon: '🟠' },
  { id: 'mtn_momo', name: 'MTN MoMo', color: '#FFCC00', icon: '🟡' },
  { id: 'moov_money', name: 'Moov Money', color: '#0066CC', icon: '🔵' },
  { id: 'wave', name: 'Wave', color: '#1DC3E4', icon: '🌊' },
];

/* ── Step enum ──────────────────────────────────────── */

type Step = 'loading' | 'error' | 'select' | 'confirming' | 'pending' | 'success' | 'failed';

/* ── Component ───────────────────────────────────────── */

export default function PaymentFlow() {
  const { orderId } = useParams<{ orderId: string }>();

  /* ── State ──────────────────────────────────────────── */
  const [step, setStep] = useState<Step>('loading');
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<string | null>(null);

  /* ── Load order ─────────────────────────────────────── */

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setStep('loading');
    setError(null);
    try {
      const data = await fetchOrderForBuyer(orderId);
      setOrder(data);
      setStep('select');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 404
            ? 'Commande introuvable'
            : err.message
          : 'Impossible de charger la commande';
      setError(message);
      setStep('error');
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  /* ── Initiate payment ───────────────────────────────── */

  const handleInitiate = useCallback(async () => {
    if (!orderId || !selectedOperator || !phone.trim()) return;
    setStep('confirming');
    setError(null);
    try {
      const paymentData = await initiatePayment({
        order_id: orderId,
        phone_number: phone.trim(),
      });
      setPayment(paymentData);
      setStep('pending');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Échec de l’initiation du paiement';
      setError(message);
      setStep('select');
    }
  }, [orderId, selectedOperator, phone]);

  /* ── Simulate webhook (sandbox) ─────────────────────── */

  const handleSimulate = useCallback(
    async (status: 'completed' | 'failed') => {
      if (!payment) return;
      setSimulating(true);
      setSimResult(null);
      try {
        const result = await simulateWebhook({
          idempotency_key: payment.idempotency_key,
          provider_ref: `SIM_${Date.now()}`,
          status,
        });
        if (status === 'completed') {
          setStep('success');
          setSimResult(
            result.already_processed
              ? 'Déjà traité (idempotent)'
              : 'Paiement confirmé avec succès',
          );
        } else {
          setStep('failed');
          setSimResult('Paiement échoué (simulation)');
        }
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Erreur de simulation';
        setSimResult(message);
      } finally {
        setSimulating(false);
      }
    },
    [payment],
  );

  /* ── Render: Loading ──────────────────────────────── */

  if (step === 'loading') {
    return (
      <div className="catalog-page" data-testid="payment-page">
        <div className="pay-container">
          <div className="detail-loading" data-testid="payment-loading">
            <div className="detail-spinner" role="status" aria-label="Chargement" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Render: Error ────────────────────────────────── */

  if (step === 'error') {
    return (
      <div className="catalog-page" data-testid="payment-page">
        <div className="pay-container">
          <div className="catalog-error" data-testid="payment-error">
            <p className="catalog-error-text">{error}</p>
            <button className="catalog-retry-btn" onClick={() => void loadOrder()}>
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render: Operator selection ────────────────────── */

  if (step === 'select' || step === 'confirming') {
    return (
      <div className="catalog-page" data-testid="payment-page">
        <div className="pay-container">
          <Link to={`/buyer/order-confirmation/${orderId}`} className="detail-back">
            &#8592; Retour à la commande
          </Link>

          <div className="pay-card" data-testid="payment-card">
            <div className="pay-header">
              <h1 className="pay-title">Paiement Mobile Money</h1>
              <p className="pay-subtitle">
                Commande #{orderId?.slice(0, 8).toUpperCase()}
              </p>
              {order && (
                <p className="pay-amount" data-testid="payment-amount">
                  {formatXOF(order.total_xof)}
                </p>
              )}
            </div>

            {/* Error banner inline */}
            {error && (
              <div className="cart-error-banner" data-testid="payment-inline-error">
                <p className="cart-error-text">{error}</p>
              </div>
            )}

            {/* Operator grid */}
            <div className="pay-operators" data-testid="operator-grid">
              {OPERATORS.map((op) => (
                <button
                  key={op.id}
                  className={`pay-operator${selectedOperator === op.id ? ' pay-operator--selected' : ''}`}
                  onClick={() => setSelectedOperator(op.id)}
                  data-testid={`operator-${op.id}`}
                  type="button"
                >
                  <span className="pay-operator-icon">
                    {op.icon}
                  </span>
                  <span className="pay-operator-name">{op.name}</span>
                </button>
              ))}
            </div>

            {/* Phone number */}
            <div className="pay-phone-wrap">
              <label htmlFor="pay-phone" className="pay-phone-label">
                Numéro de téléphone
              </label>
              <input
                id="pay-phone"
                type="tel"
                className="pay-phone-input"
                placeholder="+225 07 00 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="payment-phone"
              />
            </div>

            {/* Confirm button */}
            <button
              className="detail-add-btn pay-confirm-btn"
              disabled={!selectedOperator || !phone.trim() || step === 'confirming'}
              onClick={() => void handleInitiate()}
              data-testid="payment-confirm"
            >
              {step === 'confirming' ? (
                <>
                  <span className="auth-spinner auth-spinner--btn" aria-hidden="true" />
                  Initiation en cours...
                </>
              ) : (
                `Confirmer le paiement — ${order ? formatXOF(order.total_xof) : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render: Pending / Success / Failed ────────────── */

  const isPending = step === 'pending';
  const isSuccess = step === 'success';
  const isFailed = step === 'failed';

  return (
    <div className="catalog-page" data-testid="payment-page">
      <div className="pay-container">
        <div className="pay-card pay-status-card" data-testid="payment-status-card">
          {/* Status icon */}
          <div
            className={`pay-status-icon ${
              isSuccess
                ? 'pay-status-icon--success'
                : isFailed
                  ? 'pay-status-icon--failed'
                  : 'pay-status-icon--pending'
            }`}
            data-testid="payment-status-icon"
          >
            {isPending && (
              <div className="pay-pulse-ring" data-testid="payment-spinner" />
            )}
            {isSuccess && <span>&#10003;</span>}
            {isFailed && <span>&#10007;</span>}
          </div>

          {/* Status text */}
          <h2 className="pay-status-title" data-testid="payment-status-title">
            {isPending && 'En attente de validation sur votre mobile...'}
            {isSuccess && 'Paiement confirmé !'}
            {isFailed && 'Paiement échoué'}
          </h2>

          <p className="pay-status-sub" data-testid="payment-status-sub">
            {isPending &&
              `Validez le paiement de ${order ? formatXOF(order.total_xof) : ''} sur votre téléphone.`}
            {isSuccess && 'Votre commande sera préparée par le grossiste.'}
            {isFailed && 'Le paiement n’a pas abouti. Vous pouvez réessayer.'}
          </p>

          {/* Payment details */}
          {payment && (
            <div className="pay-details" data-testid="payment-details">
              <div className="confirmation-row">
                <span className="confirmation-label">Réf. paiement</span>
                <span className="confirmation-value" data-testid="payment-id">
                  {payment.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="confirmation-row">
                <span className="confirmation-label">Clé d&apos;idempotence</span>
                <span className="confirmation-value pay-idem-key" data-testid="payment-idem-key">
                  {payment.idempotency_key}
                </span>
              </div>
              <div className="confirmation-row">
                <span className="confirmation-label">Montant</span>
                <span className="confirmation-value" data-testid="payment-detail-amount">
                  {formatXOF(payment.amount_xof)}
                </span>
              </div>
            </div>
          )}

          {/* Sim result banner */}
          {simResult && (
            <div
              className={`pay-sim-result ${isSuccess ? 'pay-sim-result--success' : 'pay-sim-result--failed'}`}
              data-testid="sim-result"
            >
              {simResult}
            </div>
          )}

          {/* Actions */}
          <div className="pay-status-actions">
            {isSuccess && (
              <Link
                to="/buyer"
                className="confirmation-btn confirmation-btn--primary"
                data-testid="payment-go-dashboard"
              >
                Mon tableau de bord
              </Link>
            )}
            {isFailed && (
              <button
                className="catalog-retry-btn"
                onClick={() => {
                  setStep('select');
                  setPayment(null);
                  setError(null);
                  setSimResult(null);
                }}
                data-testid="payment-retry"
              >
                Réessayer
              </button>
            )}
          </div>

          {/* ── Simulation Sandbox ─────────────────────── */}
          {(isPending || isSuccess || isFailed) && payment && (
            <div className="pay-sandbox" data-testid="simulation-sandbox">
              <div className="pay-sandbox-divider" />
              <p className="pay-sandbox-label">Simulation Sandbox</p>
              <p className="pay-sandbox-hint">
                Simulez la réponse du réseau opérateur (webhook)
              </p>
              <div className="pay-sandbox-actions">
                <button
                  className="pay-sandbox-btn pay-sandbox-btn--success"
                  disabled={simulating || isSuccess}
                  onClick={() => void handleSimulate('completed')}
                  data-testid="sim-success"
                >
                  {simulating ? '...' : 'Simuler succès'}
                </button>
                <button
                  className="pay-sandbox-btn pay-sandbox-btn--fail"
                  disabled={simulating || isFailed}
                  onClick={() => void handleSimulate('failed')}
                  data-testid="sim-failure"
                >
                  {simulating ? '...' : 'Simuler échec'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
