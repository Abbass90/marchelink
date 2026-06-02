import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BuyerOrderDetail from '../BuyerOrderDetail.js';

/* ── Mocks ───────────────────────────────────────────────── */

const mockFetchOrderDetailForBuyer = vi.fn();
const mockFetchOrderTimeline = vi.fn();

vi.mock('../../api/client.js', () => ({
  fetchOrderDetailForBuyer: (...a: unknown[]) => mockFetchOrderDetailForBuyer(...a),
  fetchOrderTimeline: (...a: unknown[]) => mockFetchOrderTimeline(...a),
  ApiError: class ApiError extends Error {
    status: number; code: string;
    constructor(status: number, code: string, message: string) {
      super(message); this.status = status; this.code = code; this.name = 'ApiError';
    }
  },
}));

/* ── Factory ─────────────────────────────────────────────── */

function makeOrderDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord-abc-123-4567-8901-2345',
    wholesaler_org_id: 'org-111',
    buyer_user_id: 'buyer-222',
    status: 'pending',
    total_xof: '45000',
    payment_id: null,
    delivery_mode: null,
    org_name: 'Marché Adjamé',
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    items: [
      {
        id: 'item-1',
        order_id: 'ord-abc-123-4567-8901-2345',
        product_id: 'prod-1',
        quantity: 3,
        unit_price_xof: '15000',
        line_total_xof: '45000',
        product_name: 'Riz parfumé 25kg',
        product_unit: 'sac',
      },
    ],
    ...overrides,
  };
}

/* ── Helper ──────────────────────────────────────────────── */

function renderDetail(orderId = 'ord-abc-123-4567-8901-2345') {
  return render(
    <MemoryRouter initialEntries={[`/buyer/orders/${orderId}`]}>
      <Routes>
        <Route path="/buyer/orders/:id" element={<BuyerOrderDetail />} />
        <Route path="/buyer/orders" element={<p data-testid="orders-page">Orders</p>} />
        <Route path="/buyer/chat" element={<p data-testid="chat-page">Chat</p>} />
        <Route path="/buyer/pay/:orderId" element={<p data-testid="payment-page">Pay</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/* ── Setup ───────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchOrderTimeline.mockResolvedValue([]);
});

/* ── Tests ───────────────────────────────────────────────── */

describe('BuyerOrderDetail — §11', () => {
  it('affiche le skeleton pendant le chargement', () => {
    mockFetchOrderDetailForBuyer.mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(screen.getByTestId('bod-loading')).toBeInTheDocument();
  });

  it('affiche les détails après chargement', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail());
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-title')).toBeInTheDocument());
    expect(screen.getByTestId('bod-title').textContent).toContain('ORD-ABC-');
  });

  it('affiche le badge de statut', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail({ status: 'pending' }));
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-status')).toBeInTheDocument());
    expect(screen.getByTestId('bod-status').textContent).toContain('attente');
  });

  it('affiche les lignes de produits avec nom, quantité et prix', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail());
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-items')).toBeInTheDocument());
    const item = screen.getByTestId('bod-item');
    expect(item.textContent).toContain('Riz parfumé 25kg');
    expect(item.textContent).toContain('3');
    expect(item.textContent).toContain('sac');
    expect(item.textContent).toContain('15 000');
  });

  it('affiche le total formaté', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail({ total_xof: '45000' }));
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-total')).toBeInTheDocument());
    expect(screen.getByTestId('bod-total').textContent).toMatch(/45.000 F/);
  });

  it('affiche le nom du grossiste avec lien chat', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail());
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-org-name')).toBeInTheDocument());
    expect(screen.getByTestId('bod-org-name').textContent).toBe('Marché Adjamé');
    expect(screen.getByTestId('bod-chat-link')).toHaveAttribute('href', '/buyer/chat');
  });

  it('affiche le bouton Payer quand status est accepted', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail({ status: 'accepted' }));
    renderDetail('ord-abc-123-4567-8901-2345');
    await waitFor(() => expect(screen.getByTestId('bod-pay-link')).toBeInTheDocument());
    expect(screen.getByTestId('bod-pay-link')).toHaveAttribute(
      'href',
      '/buyer/pay/ord-abc-123-4567-8901-2345',
    );
  });

  it('cache le bouton Payer quand status est paid', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail({ status: 'paid' }));
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-title')).toBeInTheDocument());
    expect(screen.queryByTestId('bod-pay-link')).not.toBeInTheDocument();
  });

  it('cache le bouton Payer quand status est delivered', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail({ status: 'delivered' }));
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-title')).toBeInTheDocument());
    expect(screen.queryByTestId('bod-pay-link')).not.toBeInTheDocument();
  });

  it('n\'affiche pas de bloc livraison quand delivery_mode est null', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail({ delivery_mode: null }));
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-title')).toBeInTheDocument());
    expect(screen.queryByTestId('bod-swiftgo-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bod-delivery-mode')).not.toBeInTheDocument();
  });

  it('affiche le lien SwiftGo quand delivery_mode est swiftgo', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(
      makeOrderDetail({ delivery_mode: 'swiftgo' }),
    );
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-swiftgo-link')).toBeInTheDocument());
    expect(screen.getByTestId('bod-swiftgo-link')).toHaveAttribute('href', 'https://swiftgo.vip');
    expect(screen.getByTestId('bod-swiftgo-link')).toHaveAttribute('target', '_blank');
  });

  it('affiche "Livraison grossiste" quand delivery_mode est wholesaler', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(
      makeOrderDetail({ delivery_mode: 'wholesaler' }),
    );
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-delivery-mode')).toBeInTheDocument());
    expect(screen.getByTestId('bod-delivery-mode').textContent).toContain('grossiste');
  });

  it('affiche une erreur et un bouton Réessayer si le fetch échoue', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockFetchOrderDetailForBuyer.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Commande introuvable'));
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-error')).toBeInTheDocument());
    expect(screen.getByTestId('bod-error').textContent).toContain('introuvable');
    expect(screen.getByTestId('bod-retry-btn')).toBeInTheDocument();
  });

  it('le retry relance le fetch', async () => {
    const { ApiError } = await import('../../api/client.js');
    mockFetchOrderDetailForBuyer
      .mockRejectedValueOnce(new ApiError(500, 'ERR', 'Erreur réseau'))
      .mockResolvedValueOnce(makeOrderDetail());
    const user = userEvent.setup();
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-retry-btn')).toBeInTheDocument());
    await user.click(screen.getByTestId('bod-retry-btn'));
    await waitFor(() => expect(screen.getByTestId('bod-title')).toBeInTheDocument());
    expect(mockFetchOrderDetailForBuyer).toHaveBeenCalledTimes(2);
  });

  it('affiche le lien retour aux commandes', async () => {
    mockFetchOrderDetailForBuyer.mockResolvedValue(makeOrderDetail());
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('bod-back-link')).toBeInTheDocument());
    expect(screen.getByTestId('bod-back-link')).toHaveAttribute('href', '/buyer/orders');
  });
});
