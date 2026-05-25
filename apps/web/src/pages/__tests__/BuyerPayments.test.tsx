import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BuyerPayments from '../BuyerPayments.js';

/* ── Mocks ───────────────────────────────────────────────── */

const mockFetchMyPayments = vi.fn();

vi.mock('../../api/client.js', () => ({
  fetchMyPayments: (...a: unknown[]) => mockFetchMyPayments(...a),
  ApiError: class ApiError extends Error {
    status: number; code: string;
    constructor(status: number, code: string, message: string) {
      super(message); this.status = status; this.code = code; this.name = 'ApiError';
    }
  },
}));

/* ── Fixture ─────────────────────────────────────────────── */

const PAYMENT = {
  id: 'pay-1', order_id: 'ord-1', wholesaler_org_id: 'org-1',
  provider: 'orange_money', provider_ref: 'MOMO_REF_ABC',
  status: 'completed', amount_xof: '30000', idempotency_key: 'key-1',
  created_at: '2025-05-15T10:00:00.000Z', updated_at: '2025-05-15T10:01:00.000Z',
};

/* ── Helpers ─────────────────────────────────────────────── */

function renderPage() {
  return render(
    <MemoryRouter>
      <BuyerPayments />
    </MemoryRouter>,
  );
}

/* ── Setup ───────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
});

/* ── Tests ───────────────────────────────────────────────── */

describe('BuyerPayments', () => {
  it('affiche le spinner pendant le chargement', () => {
    mockFetchMyPayments.mockImplementation(() => new Promise(() => undefined));
    renderPage();
    expect(screen.getByTestId('bp-loading')).toBeInTheDocument();
  });

  it('affiche la liste des paiements après chargement', async () => {
    mockFetchMyPayments.mockResolvedValue([PAYMENT]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('bp-list')).toBeInTheDocument());
    expect(screen.getByTestId('bp-card')).toBeInTheDocument();
    expect(screen.getByText('Réf : MOMO_REF_ABC')).toBeInTheDocument();
    expect(screen.getByText('Complété')).toBeInTheDocument();
  });

  it('affiche le montant formaté en XOF', async () => {
    mockFetchMyPayments.mockResolvedValue([PAYMENT]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('bp-list')).toBeInTheDocument());
    expect(screen.getByText(/30\s*000\s*F/)).toBeInTheDocument();
  });

  it('affiche le lien vers la commande', async () => {
    mockFetchMyPayments.mockResolvedValue([PAYMENT]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('bp-order-link')).toBeInTheDocument());
    expect(screen.getByTestId('bp-order-link')).toHaveAttribute('href', '/buyer/order-confirmation/ord-1');
  });

  it('affiche l\'état vide si aucun paiement', async () => {
    mockFetchMyPayments.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('bp-empty')).toBeInTheDocument());
  });

  it('affiche l\'erreur et le bouton Réessayer en cas d\'échec', async () => {
    mockFetchMyPayments.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('bp-error')).toBeInTheDocument());
    expect(screen.getByTestId('bp-retry')).toBeInTheDocument();
  });

  it('recharge les paiements au clic sur Réessayer', async () => {
    mockFetchMyPayments
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([PAYMENT]);
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByTestId('bp-retry')).toBeInTheDocument());
    await user.click(screen.getByTestId('bp-retry'));

    await waitFor(() => expect(screen.getByTestId('bp-list')).toBeInTheDocument());
    expect(mockFetchMyPayments).toHaveBeenCalledTimes(2);
  });
});
