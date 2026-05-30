import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrderTimeline from '../OrderTimeline.js';
import type { OrderEvent } from '../../../api/client.js';

/* ── Fixtures ────────────────────────────────────────────── */

const EVENTS: OrderEvent[] = [
  { id: 'e1', order_id: 'ord-1', status: 'pending',  notes: null,                 created_at: '2025-05-01T10:00:00.000Z', created_by: 'u1' },
  { id: 'e2', order_id: 'ord-1', status: 'accepted', notes: null,                 created_at: '2025-05-01T11:00:00.000Z', created_by: 'u2' },
  { id: 'e3', order_id: 'ord-1', status: 'paid',     notes: 'Payment ref: ABC123', created_at: '2025-05-01T12:00:00.000Z', created_by: null },
];

/* ── Tests ───────────────────────────────────────────────── */

describe('OrderTimeline', () => {
  let mockFetch: ReturnType<typeof vi.fn<[string], Promise<OrderEvent[]>>>;

  beforeEach(() => {
    mockFetch = vi.fn<[string], Promise<OrderEvent[]>>();
  });

  it('affiche le spinner pendant le chargement', () => {
    mockFetch.mockImplementation(() => new Promise(() => undefined));
    render(<OrderTimeline orderId="ord-1" fetchFn={mockFetch} />);
    expect(screen.getByTestId('tl-loading')).toBeInTheDocument();
  });

  it('affiche les événements après chargement réussi', async () => {
    mockFetch.mockResolvedValue(EVENTS);
    render(<OrderTimeline orderId="ord-1" fetchFn={mockFetch} />);

    await waitFor(() => expect(screen.getByTestId('tl-list')).toBeInTheDocument());

    expect(screen.getByTestId('tl-item-pending')).toBeInTheDocument();
    expect(screen.getByTestId('tl-item-accepted')).toBeInTheDocument();
    expect(screen.getByTestId('tl-item-paid')).toBeInTheDocument();
  });

  it('affiche les labels lisibles pour chaque statut', async () => {
    mockFetch.mockResolvedValue(EVENTS);
    render(<OrderTimeline orderId="ord-1" fetchFn={mockFetch} />);

    await waitFor(() => expect(screen.getByTestId('tl-list')).toBeInTheDocument());

    expect(screen.getByText('Commande reçue')).toBeInTheDocument();
    expect(screen.getByText('Acceptée par grossiste')).toBeInTheDocument();
    expect(screen.getByText('Paiement confirmé')).toBeInTheDocument();
  });

  it('affiche les notes quand elles sont présentes', async () => {
    mockFetch.mockResolvedValue(EVENTS);
    render(<OrderTimeline orderId="ord-1" fetchFn={mockFetch} />);

    await waitFor(() => expect(screen.getByTestId('tl-list')).toBeInTheDocument());
    expect(screen.getByText('Payment ref: ABC123')).toBeInTheDocument();
  });

  it('affiche l\'erreur avec bouton retry en cas d\'échec', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<OrderTimeline orderId="ord-1" fetchFn={mockFetch} />);

    await waitFor(() => expect(screen.getByTestId('tl-error')).toBeInTheDocument());
    expect(screen.getByTestId('tl-retry')).toBeInTheDocument();
  });

  it('relance le chargement au clic sur Réessayer', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(EVENTS);
    render(<OrderTimeline orderId="ord-1" fetchFn={mockFetch} />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByTestId('tl-retry')).toBeInTheDocument());
    await user.click(screen.getByTestId('tl-retry'));

    await waitFor(() => expect(screen.getByTestId('tl-list')).toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('affiche le message vide si aucun événement', async () => {
    mockFetch.mockResolvedValue([]);
    render(<OrderTimeline orderId="ord-1" fetchFn={mockFetch} />);

    await waitFor(() => expect(screen.getByTestId('tl-empty')).toBeInTheDocument());
  });

  it('appelle fetchFn avec le bon orderId', async () => {
    mockFetch.mockResolvedValue([]);
    render(<OrderTimeline orderId="mon-ordre-42" fetchFn={mockFetch} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('mon-ordre-42'));
  });
});
