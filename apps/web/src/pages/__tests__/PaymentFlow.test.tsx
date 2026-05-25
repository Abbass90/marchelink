import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentFlow from '../PaymentFlow.js';
import type { OrderResponse, PaymentResponse, WebhookResponse } from '../../api/client.js';

/* ── Mock API ────────────────────────────────────────── */

const mockFetchOrder = vi.fn();
const mockInitiatePayment = vi.fn();
const mockSimulateWebhook = vi.fn();

vi.mock('../../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../../api/client.js')>('../../api/client.js');
  return {
    ...actual,
    fetchOrderForBuyer: (...args: unknown[]) => mockFetchOrder(...args),
    initiatePayment: (...args: unknown[]) => mockInitiatePayment(...args),
    simulateWebhook: (...args: unknown[]) => mockSimulateWebhook(...args),
  };
});

/* ── Test Data ───────────────────────────────────────── */

const ORDER_ID = 'aaaa1111-2222-3333-4444-555566667777';

const fakeOrder: OrderResponse = {
  id: ORDER_ID,
  wholesaler_org_id: 'org-aaaa-1111-2222-333344445555',
  buyer_user_id: 'buyer-001',
  status: 'accepted',
  total_xof: '42500',
  payment_id: null,
  delivery_id: null,
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
  items: [
    {
      id: 'oi-001',
      order_id: ORDER_ID,
      product_id: 'p-001',
      quantity: 2,
      unit_price_xof: '15000',
      line_total_xof: '30000',
    },
    {
      id: 'oi-002',
      order_id: ORDER_ID,
      product_id: 'p-002',
      quantity: 1,
      unit_price_xof: '12500',
      line_total_xof: '12500',
    },
  ],
};

const fakePayment: PaymentResponse = {
  id: 'pay-001',
  order_id: ORDER_ID,
  wholesaler_org_id: 'org-aaaa-1111-2222-333344445555',
  provider: 'orange_money',
  provider_ref: null,
  status: 'pending',
  amount_xof: '42500',
  idempotency_key: 'pay_unique-uuid-1234',
  created_at: '2026-01-10T01:00:00Z',
  updated_at: '2026-01-10T01:00:00Z',
};

const fakeWebhookSuccess: WebhookResponse = {
  already_processed: false,
  payment: { ...fakePayment, status: 'completed', provider_ref: 'SIM_123' },
};

const fakeWebhookIdempotent: WebhookResponse = {
  already_processed: true,
  payment: { ...fakePayment, status: 'completed', provider_ref: 'SIM_123' },
};

const fakeWebhookFailed: WebhookResponse = {
  already_processed: false,
  payment: { ...fakePayment, status: 'failed', provider_ref: 'SIM_456' },
};

/* ── Helper ──────────────────────────────────────────── */

function renderPayment(orderId: string = ORDER_ID) {
  return render(
    <MemoryRouter initialEntries={[`/buyer/pay/${orderId}`]}>
      <Routes>
        <Route path="/buyer/pay/:orderId" element={<PaymentFlow />} />
        <Route
          path="/buyer/order-confirmation/:id"
          element={<p data-testid="confirmation-page">Confirmation</p>}
        />
        <Route
          path="/buyer"
          element={<p data-testid="dashboard-page">Dashboard</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

/* ── Tests ───────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PaymentFlow — UC-13', () => {
  describe('Three-state rendering', () => {
    it('shows loading spinner while fetching order', () => {
      mockFetchOrder.mockReturnValue(new Promise(() => {})); // never resolves
      renderPayment();

      expect(screen.getByTestId('payment-loading')).toBeInTheDocument();
    });

    it('shows error state when order not found', async () => {
      const { ApiError } = await import('../../api/client.js');
      mockFetchOrder.mockRejectedValueOnce(
        new ApiError(404, 'NOT_FOUND', 'Not found'),
      );

      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-error')).toBeInTheDocument();
      });
      expect(screen.getByText('Commande introuvable')).toBeInTheDocument();
    });

    it('shows error state on generic API failure', async () => {
      mockFetchOrder.mockRejectedValueOnce(new Error('Network fail'));
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-error')).toBeInTheDocument();
      });
      expect(screen.getByText('Impossible de charger la commande')).toBeInTheDocument();
    });

    it('retry button refetches the order', async () => {
      mockFetchOrder
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(fakeOrder);

      renderPayment();

      await waitFor(() => {
        expect(screen.getByText('Réessayer')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Réessayer'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });
      expect(mockFetchOrder).toHaveBeenCalledTimes(2);
    });
  });

  describe('Operator selection', () => {
    beforeEach(async () => {
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      renderPayment();
      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });
    });

    it('fetches order with correct ID', () => {
      expect(mockFetchOrder).toHaveBeenCalledWith(ORDER_ID);
    });

    it('displays order amount in XOF', () => {
      expect(screen.getByTestId('payment-amount').textContent).toMatch(/42.500 F/);
    });

    it('renders four operator buttons', () => {
      expect(screen.getByTestId('operator-orange_money')).toBeInTheDocument();
      expect(screen.getByTestId('operator-mtn_momo')).toBeInTheDocument();
      expect(screen.getByTestId('operator-moov_money')).toBeInTheDocument();
      expect(screen.getByTestId('operator-wave')).toBeInTheDocument();
    });

    it('selects an operator on click', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-orange_money'));

      expect(screen.getByTestId('operator-orange_money').className).toContain(
        'pay-operator--selected',
      );
    });

    it('renders phone number input', () => {
      expect(screen.getByTestId('payment-phone')).toBeInTheDocument();
    });

    it('confirm button is disabled without operator and phone', () => {
      expect(screen.getByTestId('payment-confirm')).toBeDisabled();
    });

    it('confirm button is disabled with operator but no phone', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-mtn_momo'));

      expect(screen.getByTestId('payment-confirm')).toBeDisabled();
    });

    it('confirm button is enabled with operator and phone', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-orange_money'));
      await user.type(screen.getByTestId('payment-phone'), '0700000000');

      expect(screen.getByTestId('payment-confirm')).not.toBeDisabled();
    });

    it('confirm button shows XOF amount', () => {
      expect(screen.getByTestId('payment-confirm').textContent).toMatch(/42.500 F/);
    });
  });

  describe('Payment initiation', () => {
    it('calls initiatePayment with correct payload', async () => {
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      mockInitiatePayment.mockResolvedValueOnce(fakePayment);
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-orange_money'));
      await user.type(screen.getByTestId('payment-phone'), '+2250700000000');
      await user.click(screen.getByTestId('payment-confirm'));

      await waitFor(() => {
        expect(mockInitiatePayment).toHaveBeenCalledWith({
          order_id: ORDER_ID,
          phone_number: '+2250700000000',
        });
      });
    });

    it('shows pending state after successful initiation', async () => {
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      mockInitiatePayment.mockResolvedValueOnce(fakePayment);
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-wave'));
      await user.type(screen.getByTestId('payment-phone'), '0700000000');
      await user.click(screen.getByTestId('payment-confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-status-card')).toBeInTheDocument();
      });
      expect(screen.getByTestId('payment-status-title').textContent).toContain(
        'En attente de validation',
      );
      expect(screen.getByTestId('payment-spinner')).toBeInTheDocument();
    });

    it('displays idempotency key in pending view', async () => {
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      mockInitiatePayment.mockResolvedValueOnce(fakePayment);
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-orange_money'));
      await user.type(screen.getByTestId('payment-phone'), '0700000000');
      await user.click(screen.getByTestId('payment-confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-idem-key')).toBeInTheDocument();
      });
      expect(screen.getByTestId('payment-idem-key').textContent).toBe(
        'pay_unique-uuid-1234',
      );
    });

    it('displays payment reference ID', async () => {
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      mockInitiatePayment.mockResolvedValueOnce(fakePayment);
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-orange_money'));
      await user.type(screen.getByTestId('payment-phone'), '0700000000');
      await user.click(screen.getByTestId('payment-confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-id')).toBeInTheDocument();
      });
      expect(screen.getByTestId('payment-id').textContent).toBe('PAY-001');
    });

    it('shows loading state on confirm button while initiating', async () => {
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      mockInitiatePayment.mockReturnValue(new Promise(() => {})); // never resolves
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-orange_money'));
      await user.type(screen.getByTestId('payment-phone'), '0700000000');
      await user.click(screen.getByTestId('payment-confirm'));

      expect(screen.getByTestId('payment-confirm')).toBeDisabled();
      expect(screen.getByTestId('payment-confirm').textContent).toContain(
        'Initiation en cours',
      );
    });

    it('shows inline error when initiation fails', async () => {
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      mockInitiatePayment.mockRejectedValueOnce(new Error('fail'));
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-mtn_momo'));
      await user.type(screen.getByTestId('payment-phone'), '0700000000');
      await user.click(screen.getByTestId('payment-confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-inline-error')).toBeInTheDocument();
      });
    });

    it('shows specific API error message on initiation failure', async () => {
      const { ApiError } = await import('../../api/client.js');
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      mockInitiatePayment.mockRejectedValueOnce(
        new ApiError(422, 'VALIDATION', 'Commande non acceptée'),
      );
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-wave'));
      await user.type(screen.getByTestId('payment-phone'), '0700000000');
      await user.click(screen.getByTestId('payment-confirm'));

      await waitFor(() => {
        expect(screen.getByText('Commande non acceptée')).toBeInTheDocument();
      });
    });
  });

  describe('Simulation sandbox', () => {
    async function goToPending() {
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      mockInitiatePayment.mockResolvedValueOnce(fakePayment);
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('operator-orange_money'));
      await user.type(screen.getByTestId('payment-phone'), '0700000000');
      await user.click(screen.getByTestId('payment-confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('simulation-sandbox')).toBeInTheDocument();
      });

      return user;
    }

    it('shows sandbox section in pending state', async () => {
      await goToPending();

      expect(screen.getByTestId('sim-success')).toBeInTheDocument();
      expect(screen.getByTestId('sim-failure')).toBeInTheDocument();
      expect(screen.getByText('Simulation Sandbox')).toBeInTheDocument();
    });

    it('simulate success transitions to success state', async () => {
      mockSimulateWebhook.mockResolvedValueOnce(fakeWebhookSuccess);
      const user = await goToPending();

      await user.click(screen.getByTestId('sim-success'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-status-title').textContent).toContain(
          'Paiement confirmé',
        );
      });
      expect(screen.getByTestId('sim-result')).toBeInTheDocument();
      expect(screen.getByText('Paiement confirmé avec succès')).toBeInTheDocument();
    });

    it('simulate success calls webhook with correct payload', async () => {
      mockSimulateWebhook.mockResolvedValueOnce(fakeWebhookSuccess);
      const user = await goToPending();

      await user.click(screen.getByTestId('sim-success'));

      await waitFor(() => {
        expect(mockSimulateWebhook).toHaveBeenCalledTimes(1);
      });

      const call = mockSimulateWebhook.mock.calls[0]![0];
      expect(call.idempotency_key).toBe('pay_unique-uuid-1234');
      expect(call.status).toBe('completed');
      expect(call.provider_ref).toMatch(/^SIM_/);
    });

    it('simulate failure transitions to failed state', async () => {
      mockSimulateWebhook.mockResolvedValueOnce(fakeWebhookFailed);
      const user = await goToPending();

      await user.click(screen.getByTestId('sim-failure'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-status-title').textContent).toContain(
          'Paiement échoué',
        );
      });
    });

    it('idempotent webhook shows idempotent message', async () => {
      mockSimulateWebhook.mockResolvedValueOnce(fakeWebhookIdempotent);
      const user = await goToPending();

      await user.click(screen.getByTestId('sim-success'));

      await waitFor(() => {
        expect(screen.getByText(/idempotent/i)).toBeInTheDocument();
      });
    });

    it('success state shows dashboard link', async () => {
      mockSimulateWebhook.mockResolvedValueOnce(fakeWebhookSuccess);
      const user = await goToPending();

      await user.click(screen.getByTestId('sim-success'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-go-dashboard')).toHaveAttribute(
          'href',
          '/buyer',
        );
      });
    });

    it('success state disables simulate success button', async () => {
      mockSimulateWebhook.mockResolvedValueOnce(fakeWebhookSuccess);
      const user = await goToPending();

      await user.click(screen.getByTestId('sim-success'));

      await waitFor(() => {
        expect(screen.getByTestId('sim-success')).toBeDisabled();
      });
    });

    it('failed state shows retry button', async () => {
      mockSimulateWebhook.mockResolvedValueOnce(fakeWebhookFailed);
      const user = await goToPending();

      await user.click(screen.getByTestId('sim-failure'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-retry')).toBeInTheDocument();
      });
    });

    it('retry button goes back to operator selection', async () => {
      mockSimulateWebhook.mockResolvedValueOnce(fakeWebhookFailed);
      const user = await goToPending();

      await user.click(screen.getByTestId('sim-failure'));

      await waitFor(() => {
        expect(screen.getByTestId('payment-retry')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('payment-retry'));

      expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      expect(screen.getByTestId('operator-grid')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('renders back link to order confirmation', async () => {
      mockFetchOrder.mockResolvedValueOnce(fakeOrder);
      renderPayment();

      await waitFor(() => {
        expect(screen.getByTestId('payment-card')).toBeInTheDocument();
      });

      const backLink = screen.getByText(/Retour à la commande/);
      expect(backLink).toHaveAttribute(
        'href',
        `/buyer/order-confirmation/${ORDER_ID}`,
      );
    });
  });
});
