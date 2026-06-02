import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrderConfirmation from '../OrderConfirmation.js';

/* ── Mock API client ────────────────────────────────── */

const mockFetchOrderForBuyer = vi.fn();
const mockFetchOrderTimeline = vi.fn();

vi.mock('../../api/client.js', () => ({
  fetchOrderForBuyer: (...args: unknown[]) => mockFetchOrderForBuyer(...args),
  fetchOrderTimeline: (...args: unknown[]) => mockFetchOrderTimeline(...args),
}));

/* ── Factory ─────────────────────────────────────────── */

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abcd1234-5678-9012-3456-789012345678',
    wholesaler_org_id: 'org-111',
    buyer_user_id: 'buyer-222',
    status: 'pending',
    total_xof: '42500',
    payment_id: null,
    delivery_mode: null,
    created_at: '2026-05-30T10:00:00Z',
    updated_at: '2026-05-30T10:00:00Z',
    items: [],
    ...overrides,
  };
}

/* ── Helper ──────────────────────────────────────────── */

function renderConfirmation(
  id: string,
  state?: { orderId?: string; totalXof?: string },
) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: `/buyer/order-confirmation/${id}`,
          state: state ?? undefined,
        },
      ]}
    >
      <Routes>
        <Route
          path="/buyer/order-confirmation/:id"
          element={<OrderConfirmation />}
        />
        <Route
          path="/buyer/catalog"
          element={<p data-testid="catalog-page">Catalog</p>}
        />
        <Route
          path="/buyer"
          element={<p data-testid="dashboard-page">Dashboard</p>}
        />
        <Route
          path="/buyer/pay/:orderId"
          element={<p data-testid="payment-page">Payment</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

/* ── Tests ───────────────────────────────────────────── */

describe('OrderConfirmation — UC-12', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOrderTimeline.mockResolvedValue([]);
  });

  it('renders confirmation page after loading', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder());
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-page')).toBeInTheDocument();
      expect(screen.getByTestId('confirmation-card')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton while fetching', () => {
    // Never resolves — stays in loading state
    mockFetchOrderForBuyer.mockReturnValue(new Promise(() => {}));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
    });

    expect(screen.getByTestId('confirmation-loading')).toBeInTheDocument();
  });

  it('displays pending title for pending orders', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ status: 'pending' }));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-title').textContent).toContain(
        'Commande enregistrée',
      );
    });
  });

  it('displays truncated order ID', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder());
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-order-id').textContent).toBe(
        'ABCD1234',
      );
    });
  });

  it('displays total formatted in XOF', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ total_xof: '42500' }));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-total').textContent).toMatch(
        /42.500 F/,
      );
    });
  });

  it('renders link to catalog', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder());
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-catalog-link')).toHaveAttribute(
        'href',
        '/buyer/catalog',
      );
    });
  });

  /* ── Pay button conditional on status ────────────── */

  it('shows pay button only when status is accepted', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ status: 'accepted' }));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-pay-link')).toHaveAttribute(
        'href',
        '/buyer/pay/abcd1234-5678-9012-3456',
      );
    });
  });

  it('hides pay button when status is pending', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ status: 'pending' }));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-title')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('confirmation-pay-link')).not.toBeInTheDocument();
  });

  it('hides pay button when status is paid', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ status: 'paid' }));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-title').textContent).toContain(
        'Paiement confirmé',
      );
    });
    expect(screen.queryByTestId('confirmation-pay-link')).not.toBeInTheDocument();
  });

  it('hides pay button when status is delivered', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ status: 'delivered' }));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-title').textContent).toContain(
        'Commande livrée',
      );
    });
    expect(screen.queryByTestId('confirmation-pay-link')).not.toBeInTheDocument();
  });

  /* ── Status-specific display ───────────────────────── */

  it('shows accepted title and subtitle', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ status: 'accepted' }));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-title').textContent).toContain(
        'Commande acceptée',
      );
      expect(screen.getByTestId('confirmation-status').textContent).toContain(
        'Acceptée',
      );
    });
  });

  it('shows shipped title', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ status: 'shipped' }));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-title').textContent).toContain(
        'Commande expédiée',
      );
    });
  });

  it('shows cancelled title', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ status: 'cancelled' }));
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-title').textContent).toContain(
        'Commande annulée',
      );
    });
  });

  /* ── §5 Mode de livraison ──────────────────────────── */

  it('n\'affiche pas de badge livraison quand delivery_mode est null', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(makeOrder({ status: 'accepted', delivery_mode: null }));
    renderConfirmation('abcd1234-5678-9012-3456', { orderId: 'abcd1234-5678-9012-3456' });

    await waitFor(() => expect(screen.getByTestId('confirmation-title')).toBeInTheDocument());
    expect(screen.queryByTestId('confirmation-swiftgo-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirmation-delivery-mode')).not.toBeInTheDocument();
  });

  it('affiche le lien SwiftGo quand delivery_mode est swiftgo', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(
      makeOrder({ status: 'shipped', delivery_mode: 'swiftgo' }),
    );
    renderConfirmation('abcd1234-5678-9012-3456', { orderId: 'abcd1234-5678-9012-3456' });

    await waitFor(() => expect(screen.getByTestId('confirmation-swiftgo-link')).toBeInTheDocument());
    expect(screen.getByTestId('confirmation-swiftgo-link')).toHaveAttribute('href', 'https://swiftgo.vip');
    expect(screen.getByTestId('confirmation-swiftgo-link')).toHaveAttribute('target', '_blank');
  });

  it('affiche "Livraison grossiste" quand delivery_mode est wholesaler', async () => {
    mockFetchOrderForBuyer.mockResolvedValue(
      makeOrder({ status: 'shipped', delivery_mode: 'wholesaler' }),
    );
    renderConfirmation('abcd1234-5678-9012-3456', { orderId: 'abcd1234-5678-9012-3456' });

    await waitFor(() => expect(screen.getByTestId('confirmation-delivery-mode')).toBeInTheDocument());
    expect(screen.getByTestId('confirmation-delivery-mode').textContent).toContain('grossiste');
  });

  /* ── Fallback ──────────────────────────────────────── */

  it('falls back gracefully without location state', async () => {
    // API fails — component falls back to default pending display
    mockFetchOrderForBuyer.mockRejectedValue(new Error('Not found'));
    renderConfirmation('fallback1-0000-0000-0000');

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-order-id').textContent).toBe(
        'FALLBACK',
      );
    });
    // No total shown without state and API failed
    expect(screen.queryByTestId('confirmation-total')).not.toBeInTheDocument();
    // No pay button either (default pending state)
    expect(screen.queryByTestId('confirmation-pay-link')).not.toBeInTheDocument();
  });
});
