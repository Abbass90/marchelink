import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Clock, CheckCircle, XCircle, Ban, CreditCard, Truck, CheckCircle2, Check } from 'lucide-react';
import type { OrderEvent } from '../../api/client.js';
import '../primitives/timeline.css';

/* ── Status config ───────────────────────────────────────── */

const STATUS_META: Record<string, { label: string; icon: ReactNode; dotClass: string }> = {
  pending:   { label: 'Commande reçue',        icon: <Clock size={14} />,         dotClass: 'tl-dot--done' },
  accepted:  { label: 'Acceptée par grossiste', icon: <CheckCircle size={14} />,  dotClass: 'tl-dot--done' },
  rejected:  { label: 'Refusée',               icon: <XCircle size={14} />,       dotClass: 'tl-dot--danger' },
  cancelled: { label: 'Annulée',               icon: <Ban size={14} />,           dotClass: 'tl-dot--danger' },
  paid:      { label: 'Paiement confirmé',      icon: <CreditCard size={14} />,   dotClass: 'tl-dot--done' },
  shipped:   { label: 'En cours de livraison',  icon: <Truck size={14} />,        dotClass: 'tl-dot--active' },
  delivered: { label: 'Livrée',                icon: <CheckCircle2 size={14} />,  dotClass: 'tl-dot--success' },
};

function dotClass(status: string, isLast: boolean): string {
  if (!isLast) return 'tl-dot tl-dot--done';
  return `tl-dot ${STATUS_META[status]?.dotClass ?? 'tl-dot--active'}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── Props ───────────────────────────────────────────────── */

interface Props {
  orderId: string;
  fetchFn: (id: string) => Promise<OrderEvent[]>;
}

/* ── Component ───────────────────────────────────────────── */

export default function OrderTimeline({ orderId, fetchFn }: Props) {
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFn(orderId);
      setEvents(data);
    } catch {
      setError('Impossible de charger le suivi de commande.');
    } finally {
      setLoading(false);
    }
  }, [orderId, fetchFn]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="tl-wrap" data-testid="order-timeline">
      <h2 className="tl-title">Suivi de commande</h2>

      {loading && (
        <div className="tl-loading" data-testid="tl-loading">
          <div className="tl-spinner" />
          <span>Chargement…</span>
        </div>
      )}

      {error && !loading && (
        <div className="tl-error" data-testid="tl-error">
          <span>{error}</span>
          <button className="tl-retry-btn" data-testid="tl-retry" onClick={() => void load()}>
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="tl-empty" data-testid="tl-empty">Aucun événement disponible.</p>
      )}

      {!loading && !error && events.length > 0 && (
        <ol className="tl-list" data-testid="tl-list">
          {events.map((ev, idx) => {
            const meta = STATUS_META[ev.status];
            const isLast = idx === events.length - 1;
            return (
              <li key={ev.id} className="tl-item" data-testid={`tl-item-${ev.status}`}>
                <span className={dotClass(ev.status, isLast)} aria-hidden="true">
                  {isLast ? (meta?.icon ?? <Check size={14} />) : <Check size={14} />}
                </span>
                <div className="tl-content">
                  <span className="tl-status-label">{meta?.label ?? ev.status}</span>
                  <time className="tl-date" dateTime={ev.created_at}>
                    {formatDate(ev.created_at)}
                  </time>
                  {ev.notes && <p className="tl-notes">{ev.notes}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
