import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WholesalerOrderDetail from '../WholesalerOrderDetail.js';

/* ── Mocks ───────────────────────────────────────────────── */

const mockFetchOrgOrder = vi.fn();
const mockUpdateOrderStatus = vi.fn();
const mockFetchOrgOrderTimeline = vi.fn();

vi.mock('../../api/client.js', () => ({
  fetchOrgOrder: (...a: unknown[]) => mockFetchOrgOrder(...a),
  updateOrderStatus: (...a: unknown[]) => mockUpdateOrderStatus(...a),
  fetchOrgOrderTimeline: (...a: unknown[]) => mockFetchOrgOrderTimeline(...a),
  ApiError: class ApiError extends Error {
    status: number; code: string;
    constructor(status: number, code: string, message: string) {
      super(message); this.status = status; this.code = code; this.name = 'ApiError';
    }
  },
}));

/* ── Fixture ─────────────────────────────────────────────── */

const ORDER = {
  id: 'ord-abc-123', wholesaler_org_id: 'org-1', buyer_user_id: 'u-1',
  status: 'pending', total_xof: '30000', payment_id: null,
  created_at: '2025-05-15T09:00:00.000Z', updated_at: '2025-05-15T09:00:00.000Z',
  items: [
    { id: 'i1', order_id: 'ord-abc-123', product_id: 'p1', quantity: 2, unit_price_xof: '15000', line_total_xof: '30000' },
  ],
};

const EVENTS = [
  { id: 'e1', order_id: 'ord-abc-123', status: 'pending', notes: null, created_at: '2025-05-15T09:00:00.000Z', created_by: null },
];

/* ── Helpers ─────────────────────────────────────────────── */

function renderDetail(orderId = 'ord-abc-123') {
  return render(
    <MemoryRouter initialEntries={[`/wholesaler/orders/${orderId}`]}>
      <Routes>
        <Route path="/wholesaler/orders/:id" element={<WholesalerOrderDetail />} />
        <Route path="/wholesaler/orders" element={<div data-testid="orders-page">Orders</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/* ── Setup ───────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchOrgOrder.mockResolvedValue(ORDER);
  mockFetchOrgOrderTimeline.mockResolvedValue(EVENTS);
});

/* ── Tests ───────────────────────────────────────────────── */

describe('WholesalerOrderDetail', () => {
  it('affiche le spinner pendant le chargement', () => {
    mockFetchOrgOrder.mockImplementation(() => new Promise(() => undefined));
    renderDetail();
    expect(screen.getByTestId('od-loading')).toBeInTheDocument();
  });

  it('affiche les détails de la commande après chargement', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('od-title')).toBeInTheDocument());
    expect(screen.getByTestId('od-title').textContent).toContain('ORD-ABC-');
  });

  it('affiche les boutons Accepter et Refuser pour commande pending', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('od-accept-btn')).toBeInTheDocument());
    expect(screen.getByTestId('od-reject-btn')).toBeInTheDocument();
  });

  it('n\'affiche pas les boutons d\'action pour commande acceptée', async () => {
    mockFetchOrgOrder.mockResolvedValue({ ...ORDER, status: 'accepted' });
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('od-title')).toBeInTheDocument());
    expect(screen.queryByTestId('od-accept-btn')).not.toBeInTheDocument();
  });

  it('appelle updateOrderStatus et met à jour le statut au clic Accepter', async () => {
    mockUpdateOrderStatus.mockResolvedValue({ ...ORDER, status: 'accepted' });
    renderDetail();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByTestId('od-accept-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('od-accept-btn'));

    await waitFor(() => expect(mockUpdateOrderStatus).toHaveBeenCalledWith('ord-abc-123', 'accepted'));
    expect(screen.queryByTestId('od-accept-btn')).not.toBeInTheDocument();
  });

  it('affiche l\'erreur API si updateOrderStatus échoue', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockUpdateOrderStatus.mockRejectedValue(new ApiError(422, 'ERR', 'Statut invalide'));
    renderDetail();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByTestId('od-accept-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('od-accept-btn'));

    await waitFor(() => expect(screen.getByTestId('od-action-error')).toBeInTheDocument());
    expect(screen.getByTestId('od-action-error').textContent).toContain('Statut invalide');
  });

  it('affiche la timeline via OrderTimeline', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('order-timeline')).toBeInTheDocument());
    expect(mockFetchOrgOrderTimeline).toHaveBeenCalledWith('ord-abc-123');
  });

  it('affiche l\'erreur de chargement si fetchOrgOrder échoue', async () => {
    mockFetchOrgOrder.mockRejectedValue(new Error('Network error'));
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('od-error')).toBeInTheDocument());
  });

  it('affiche le lien retour aux commandes', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('od-back-link')).toBeInTheDocument());
  });
});
