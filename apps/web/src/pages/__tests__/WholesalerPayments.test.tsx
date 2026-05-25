import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WholesalerPayments from '../WholesalerPayments.js';

/* ── Mocks ───────────────────────────────────────────────── */

const mockFetchOrgPayments = vi.fn();

vi.mock('../../api/client.js', () => ({
  fetchOrgPayments: (...a: unknown[]) => mockFetchOrgPayments(...a),
  ApiError: class ApiError extends Error {
    status: number; code: string;
    constructor(status: number, code: string, message: string) {
      super(message); this.status = status; this.code = code; this.name = 'ApiError';
    }
  },
}));

/* ── Fixture ─────────────────────────────────────────────── */

const PAYMENT = {
  id: 'pay-2', order_id: 'ord-2', wholesaler_org_id: 'org-1',
  provider: 'orange_money', provider_ref: 'GROSS_REF_XYZ',
  status: 'completed', amount_xof: '45000', idempotency_key: 'key-2',
  created_at: '2025-05-16T08:00:00.000Z', updated_at: '2025-05-16T08:01:00.000Z',
};

/* ── Helpers ─────────────────────────────────────────────── */

function renderPage() {
  return render(
    <MemoryRouter>
      <WholesalerPayments />
    </MemoryRouter>,
  );
}

/* ── Setup ───────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
});

/* ── Tests ───────────────────────────────────────────────── */

describe('WholesalerPayments', () => {
  it('affiche le spinner pendant le chargement', () => {
    mockFetchOrgPayments.mockImplementation(() => new Promise(() => undefined));
    renderPage();
    expect(screen.getByTestId('wp-loading')).toBeInTheDocument();
  });

  it('affiche la liste des paiements après chargement', async () => {
    mockFetchOrgPayments.mockResolvedValue([PAYMENT]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('wp-list')).toBeInTheDocument());
    expect(screen.getByTestId('wp-card')).toBeInTheDocument();
    expect(screen.getByText('Réf : GROSS_REF_XYZ')).toBeInTheDocument();
    expect(screen.getByText('Complété')).toBeInTheDocument();
  });

  it('affiche le montant formaté en XOF', async () => {
    mockFetchOrgPayments.mockResolvedValue([PAYMENT]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('wp-list')).toBeInTheDocument());
    expect(screen.getByText(/45\s*000\s*F/)).toBeInTheDocument();
  });

  it('affiche le lien vers la commande grossiste', async () => {
    mockFetchOrgPayments.mockResolvedValue([PAYMENT]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('wp-order-link')).toBeInTheDocument());
    expect(screen.getByTestId('wp-order-link')).toHaveAttribute('href', '/wholesaler/orders/ord-2');
  });

  it('affiche l\'état vide si aucun paiement', async () => {
    mockFetchOrgPayments.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('wp-empty')).toBeInTheDocument());
  });

  it('affiche l\'erreur et le bouton Réessayer en cas d\'échec', async () => {
    mockFetchOrgPayments.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('wp-error')).toBeInTheDocument());
    expect(screen.getByTestId('wp-retry')).toBeInTheDocument();
  });

  it('recharge les paiements au clic sur Réessayer', async () => {
    mockFetchOrgPayments
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([PAYMENT]);
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByTestId('wp-retry')).toBeInTheDocument());
    await user.click(screen.getByTestId('wp-retry'));

    await waitFor(() => expect(screen.getByTestId('wp-list')).toBeInTheDocument());
    expect(mockFetchOrgPayments).toHaveBeenCalledTimes(2);
  });
});
