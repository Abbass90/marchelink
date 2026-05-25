import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeliveryDashboard from '../DeliveryDashboard.js';

/* ── Mocks ──────────────────────────────────────────── */

const mockFetchAvailableDeliveries = vi.fn();
const mockFetchMyDeliveries = vi.fn();
const mockAcceptDelivery = vi.fn();
const mockCompleteDelivery = vi.fn();

vi.mock('../../api/client.js', () => ({
  fetchAvailableDeliveries: (...args: unknown[]) => mockFetchAvailableDeliveries(...args),
  fetchMyDeliveries: (...args: unknown[]) => mockFetchMyDeliveries(...args),
  acceptDelivery: (...args: unknown[]) => mockAcceptDelivery(...args),
  completeDelivery: (...args: unknown[]) => mockCompleteDelivery(...args),
}));

/* ── Test data ──────────────────────────────────────── */

const AVAILABLE_ORDERS = [
  {
    id: 'order-aaa11111-2222-3333-4444',
    wholesaler_org_id: 'org-1',
    buyer_user_id: 'buyer-1',
    status: 'paid',
    total_xof: '75000',
    created_at: '2026-05-20T10:30:00Z',
  },
  {
    id: 'order-bbb22222-3333-4444-5555',
    wholesaler_org_id: 'org-1',
    buyer_user_id: 'buyer-2',
    status: 'paid',
    total_xof: '32500',
    created_at: '2026-05-20T09:15:00Z',
  },
];

const MY_DELIVERIES = [
  {
    id: 'del-ccc33333-4444-5555-6666',
    order_id: 'order-xxx00000-1111-2222-3333',
    wholesaler_org_id: 'org-1',
    assigned_to_user_id: 'driver-1',
    status: 'assigned',
    completed_at: null,
    created_at: '2026-05-20T08:00:00Z',
    updated_at: '2026-05-20T08:00:00Z',
  },
  {
    id: 'del-ddd44444-5555-6666-7777',
    order_id: 'order-yyy11111-2222-3333-4444',
    wholesaler_org_id: 'org-1',
    assigned_to_user_id: 'driver-1',
    status: 'delivered',
    completed_at: '2026-05-19T17:30:00Z',
    created_at: '2026-05-19T14:00:00Z',
    updated_at: '2026-05-19T17:30:00Z',
  },
];

/* ── Helpers ────────────────────────────────────────── */

function renderDashboard(initialView: string = 'available') {
  const entry = initialView === 'available' ? '/delivery' : `/delivery?view=${initialView}`;
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/delivery" element={<DeliveryDashboard />} />
      </Routes>
    </MemoryRouter>,
  );
}

/* ── Tests ──────────────────────────────────────────── */

describe('DeliveryDashboard — UC-06, UC-16, UC-17, UC-18, UC-19', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── Tab Navigation ────────────────────────────────── */

  it('starts on the available tab by default', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-available-section')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('del-mine-section')).not.toBeInTheDocument();
  });

  it('shows available tab badge count', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-avail-count')).toBeInTheDocument();
    });
    expect(screen.getByTestId('del-avail-count').textContent).toBe('2');
  });

  it('shows mine tab badge with active delivery count', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-mine-count')).toBeInTheDocument();
    });
    /* Only 1 active (assigned), the other is delivered */
    expect(screen.getByTestId('del-mine-count').textContent).toBe('1');
  });

  it('switches to mine tab on click', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-tab-mine')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-tab-mine'));
    expect(screen.getByTestId('del-mine-section')).toBeInTheDocument();
    expect(screen.queryByTestId('del-available-section')).not.toBeInTheDocument();
  });

  it('switches back to available tab', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-tab-mine')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-tab-mine'));
    expect(screen.getByTestId('del-mine-section')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('del-tab-available'));
    expect(screen.getByTestId('del-available-section')).toBeInTheDocument();
    expect(screen.queryByTestId('del-mine-section')).not.toBeInTheDocument();
  });

  /* ── Available: Loading ────────────────────────────── */

  it('shows loading state for available deliveries', () => {
    mockFetchAvailableDeliveries.mockReturnValue(new Promise(() => {}));
    mockFetchMyDeliveries.mockReturnValue(new Promise(() => {}));
    renderDashboard();

    expect(screen.getByTestId('del-avail-loading')).toBeInTheDocument();
  });

  /* ── Available: Error + Retry ──────────────────────── */

  it('shows error state for available deliveries with retry', async () => {
    mockFetchAvailableDeliveries.mockRejectedValueOnce(new Error('Network fail'));
    mockFetchMyDeliveries.mockResolvedValueOnce([]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-avail-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Network fail')).toBeInTheDocument();
    expect(screen.getByTestId('del-avail-retry')).toBeInTheDocument();
  });

  it('retries available fetch on retry button click', async () => {
    mockFetchAvailableDeliveries
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValue([]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-avail-retry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-avail-retry'));

    await waitFor(() => {
      expect(screen.getByTestId('del-avail-list')).toBeInTheDocument();
    });
    expect(mockFetchAvailableDeliveries).toHaveBeenCalledTimes(2);
  });

  /* ── Available: Empty State ────────────────────────── */

  it('shows empty state when no deliveries available', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockResolvedValueOnce([]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-avail-empty')).toBeInTheDocument();
    });
  });

  it('shows refresh button on empty available state', async () => {
    mockFetchAvailableDeliveries
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValue([]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-avail-refresh')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-avail-refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('del-avail-list')).toBeInTheDocument();
    });
  });

  /* ── Available: Order Cards ────────────────────────── */

  it('renders available order cards with ID and amount', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValueOnce([]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('del-avail-card')).toHaveLength(2);
    });

    const ids = screen.getAllByTestId('del-order-id');
    expect(ids[0]!.textContent).toBe('#ORDER-AA');
    expect(ids[1]!.textContent).toBe('#ORDER-BB');

    const amounts = screen.getAllByTestId('del-order-amount');
    expect(amounts[0]!.textContent).toMatch(/75.000 F/);
    expect(amounts[1]!.textContent).toMatch(/32.500 F/);
  });

  /* ── Available: Accept Flow ────────────────────────── */

  it('shows accept button on each available card', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValueOnce([]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('del-accept-btn')).toHaveLength(2);
    });
    expect(screen.getAllByTestId('del-accept-btn')[0]!.textContent).toBe('Accepter la course');
  });

  it('calls acceptDelivery API and switches to mine tab on success', async () => {
    mockFetchAvailableDeliveries
      .mockResolvedValueOnce(AVAILABLE_ORDERS)
      .mockResolvedValueOnce([AVAILABLE_ORDERS[1]!]);
    mockFetchMyDeliveries
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([MY_DELIVERIES[0]!]);
    mockAcceptDelivery.mockResolvedValueOnce({ id: 'new-del' });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('del-accept-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('del-accept-btn')[0]!);

    await waitFor(() => {
      expect(mockAcceptDelivery).toHaveBeenCalledWith('order-aaa11111-2222-3333-4444');
    });

    /* After accept, should switch to mine tab */
    await waitFor(() => {
      expect(screen.getByTestId('del-mine-section')).toBeInTheDocument();
    });
  });

  it('disables accept button during accepting state', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValueOnce([]);
    mockAcceptDelivery.mockReturnValue(new Promise(() => {}));
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('del-accept-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('del-accept-btn')[0]!);

    await waitFor(() => {
      expect(screen.getAllByTestId('del-accept-btn')[0]).toBeDisabled();
    });
    expect(screen.getByText('Acceptation…')).toBeInTheDocument();
  });

  it('shows error banner on accept failure', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce(AVAILABLE_ORDERS);
    mockFetchMyDeliveries.mockResolvedValueOnce([]);
    mockAcceptDelivery.mockRejectedValueOnce(new Error('Already taken'));
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('del-accept-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('del-accept-btn')[0]!);

    await waitFor(() => {
      expect(screen.getByTestId('del-accept-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Already taken')).toBeInTheDocument();
  });

  /* ── Mine: Loading ─────────────────────────────────── */

  it('shows loading state for mine tab', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockReturnValue(new Promise(() => {}));
    renderDashboard();

    /* Switch to mine tab */
    await waitFor(() => {
      expect(screen.getByTestId('del-tab-mine')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('del-tab-mine'));

    expect(screen.getByTestId('del-mine-loading')).toBeInTheDocument();
  });

  /* ── Mine: Error + Retry ───────────────────────────── */

  it('shows error state for mine tab with retry', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockRejectedValueOnce(new Error('Auth expired'));
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-tab-mine')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-tab-mine'));

    await waitFor(() => {
      expect(screen.getByTestId('del-mine-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Auth expired')).toBeInTheDocument();
  });

  it('retries mine fetch on retry button click', async () => {
    mockFetchAvailableDeliveries.mockResolvedValue([]);
    mockFetchMyDeliveries
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(MY_DELIVERIES);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-tab-mine')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-tab-mine'));

    await waitFor(() => {
      expect(screen.getByTestId('del-mine-retry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-mine-retry'));

    await waitFor(() => {
      expect(screen.getByTestId('del-active-group')).toBeInTheDocument();
    });
  });

  /* ── Mine: Empty ───────────────────────────────────── */

  it('shows empty state when no deliveries assigned', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockResolvedValueOnce([]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-tab-mine')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-tab-mine'));

    await waitFor(() => {
      expect(screen.getByTestId('del-mine-empty')).toBeInTheDocument();
    });
  });

  /* ── Mine: Active deliveries ───────────────────────── */

  it('renders active deliveries with status and complete button', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-tab-mine')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-tab-mine'));

    await waitFor(() => {
      expect(screen.getByTestId('del-active-group')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('del-mine-card');
    expect(cards).toHaveLength(1);

    expect(screen.getByTestId('del-delivery-id').textContent).toBe('#DEL-CCC3');
    expect(screen.getByTestId('del-status').textContent).toBe('En cours');
    expect(screen.getByTestId('del-complete-btn')).toBeInTheDocument();
    expect(screen.getByTestId('del-complete-btn').textContent).toBe('Marquer comme Livré');
  });

  it('shows order ID reference in mine card', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    renderDashboard();

    fireEvent.click(screen.getByTestId('del-tab-mine'));

    await waitFor(() => {
      expect(screen.getByTestId('del-mine-order-id')).toBeInTheDocument();
    });
    expect(screen.getByTestId('del-mine-order-id').textContent).toBe('#ORDER-XX');
  });

  /* ── Mine: Completed deliveries ────────────────────── */

  it('renders completed deliveries section', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    renderDashboard();

    fireEvent.click(screen.getByTestId('del-tab-mine'));

    await waitFor(() => {
      expect(screen.getByTestId('del-completed-group')).toBeInTheDocument();
    });

    const completedCards = screen.getAllByTestId('del-completed-card');
    expect(completedCards).toHaveLength(1);
    expect(screen.getByTestId('del-completed-status').textContent).toBe('Livré');
  });

  /* ── Complete Flow ─────────────────────────────────── */

  it('calls completeDelivery API and refreshes list on success', async () => {
    const deliveredVersion = { ...MY_DELIVERIES[0]!, status: 'delivered', completed_at: '2026-05-20T12:00:00Z' };
    mockFetchAvailableDeliveries.mockResolvedValue([]);
    mockFetchMyDeliveries
      .mockResolvedValueOnce(MY_DELIVERIES)
      .mockResolvedValueOnce([deliveredVersion, MY_DELIVERIES[1]!]);
    mockCompleteDelivery.mockResolvedValueOnce(deliveredVersion);
    renderDashboard();

    fireEvent.click(screen.getByTestId('del-tab-mine'));

    await waitFor(() => {
      expect(screen.getByTestId('del-complete-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-complete-btn'));

    await waitFor(() => {
      expect(mockCompleteDelivery).toHaveBeenCalledWith('del-ccc33333-4444-5555-6666');
    });

    /* After completion, fetchMyDeliveries should be called again */
    await waitFor(() => {
      expect(mockFetchMyDeliveries).toHaveBeenCalledTimes(2);
    });
  });

  it('disables complete button during completion state', async () => {
    mockFetchAvailableDeliveries.mockResolvedValue([]);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    mockCompleteDelivery.mockReturnValue(new Promise(() => {}));
    renderDashboard();

    fireEvent.click(screen.getByTestId('del-tab-mine'));

    await waitFor(() => {
      expect(screen.getByTestId('del-complete-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-complete-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('del-complete-btn')).toBeDisabled();
    });
    expect(screen.getByText('Confirmation…')).toBeInTheDocument();
  });

  it('shows error banner on complete failure', async () => {
    mockFetchAvailableDeliveries.mockResolvedValue([]);
    mockFetchMyDeliveries.mockResolvedValueOnce(MY_DELIVERIES);
    mockCompleteDelivery.mockRejectedValueOnce(new Error('Already delivered'));
    renderDashboard();

    fireEvent.click(screen.getByTestId('del-tab-mine'));

    await waitFor(() => {
      expect(screen.getByTestId('del-complete-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('del-complete-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('del-complete-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Already delivered')).toBeInTheDocument();
  });

  /* ── Both tabs load concurrently ───────────────────── */

  it('fetches both available and mine data on mount', () => {
    mockFetchAvailableDeliveries.mockReturnValue(new Promise(() => {}));
    mockFetchMyDeliveries.mockReturnValue(new Promise(() => {}));
    renderDashboard();

    expect(mockFetchAvailableDeliveries).toHaveBeenCalledOnce();
    expect(mockFetchMyDeliveries).toHaveBeenCalledOnce();
  });

  /* ── Tab badge hidden when count is zero ───────────── */

  it('hides available badge when no orders available', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockResolvedValueOnce([]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-avail-empty')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('del-avail-count')).not.toBeInTheDocument();
  });

  it('hides mine badge when no active deliveries', async () => {
    /* Only completed deliveries — no active ones */
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockResolvedValueOnce([MY_DELIVERIES[1]!]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-tab-mine')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('del-mine-count')).not.toBeInTheDocument();
  });

  /* ── Active CSS class on tab ───────────────────────── */

  it('applies active class to the selected tab', async () => {
    mockFetchAvailableDeliveries.mockResolvedValueOnce([]);
    mockFetchMyDeliveries.mockResolvedValueOnce([]);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('del-tab-available')).toBeInTheDocument();
    });

    expect(screen.getByTestId('del-tab-available').classList.contains('del-tab--active')).toBe(true);
    expect(screen.getByTestId('del-tab-mine').classList.contains('del-tab--active')).toBe(false);

    fireEvent.click(screen.getByTestId('del-tab-mine'));
    expect(screen.getByTestId('del-tab-mine').classList.contains('del-tab--active')).toBe(true);
    expect(screen.getByTestId('del-tab-available').classList.contains('del-tab--active')).toBe(false);
  });
});
