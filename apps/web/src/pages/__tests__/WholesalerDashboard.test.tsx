import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WholesalerDashboard from '../WholesalerDashboard.js';

/* ── Mocks ──────────────────────────────────────────── */

const mockLogout = vi.fn();

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'grossiste@test.com',
      role: 'wholesaler_admin',
      organization_id: 'org-1',
      first_name: 'Mamadou',
      last_name: 'Traoré',
      phone: null,
    },
    logout: mockLogout,
  }),
}));

const mockFetchDashboardStats = vi.fn();
const mockUpdateProduct = vi.fn();

vi.mock('../../api/client.js', () => ({
  fetchDashboardStats: (...args: unknown[]) => mockFetchDashboardStats(...args),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
}));

/* ── Helpers ────────────────────────────────────────── */

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/wholesaler']}>
      <WholesalerDashboard />
    </MemoryRouter>,
  );
}

const STATS_RESPONSE = {
  revenue_today_xof: 275000,
  orders_today: 12,
  orders_pending: 3,
  low_stock_products: [
    { id: 'p1', name: 'Riz Brisé 50 kg', sku: 'RIZ-50', stock_qty: 5 },
    { id: 'p2', name: 'Huile Palme 25 L', sku: 'HUI-25', stock_qty: 0 },
  ],
};

/* ── Tests ──────────────────────────────────────────── */

describe('WholesalerDashboard — UC-07', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* Loading ──────────────────────────────────────────── */

  it('shows loading spinner while fetching stats', () => {
    mockFetchDashboardStats.mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(screen.getByTestId('ws-loading')).toBeInTheDocument();
  });

  /* Error + Retry ───────────────────────────────────── */

  it('shows error state and retry button on API failure', async () => {
    mockFetchDashboardStats.mockRejectedValueOnce(new Error('Network down'));
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('ws-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Network down')).toBeInTheDocument();
    expect(screen.getByTestId('ws-retry-btn')).toBeInTheDocument();
  });

  it('retries loading on retry button click', async () => {
    mockFetchDashboardStats
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(STATS_RESPONSE);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('ws-retry-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('ws-retry-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('ws-kpi-grid')).toBeInTheDocument();
    });
    expect(mockFetchDashboardStats).toHaveBeenCalledTimes(2);
  });

  /* Success — KPI Cards ─────────────────────────────── */

  it('renders welcome title with user name', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('ws-title')).toBeInTheDocument();
    });
    expect(screen.getByText(/Mamadou/)).toBeInTheDocument();
    expect(screen.getByText(/Traoré/)).toBeInTheDocument();
  });

  it('displays revenue formatted in XOF', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('ws-revenue-value')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ws-revenue-value').textContent).toMatch(/275.000 F/);
  });

  it('displays orders today count', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('ws-orders-value')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ws-orders-value').textContent).toBe('12');
  });

  it('displays pending orders count', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('ws-pending-value')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ws-pending-value').textContent).toBe('3');
  });

  /* Stock Alerts ────────────────────────────────────── */

  it('shows stock alert items with badge count', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('ws-stock-alerts')).toBeInTheDocument();
    });

    expect(screen.getByTestId('ws-alert-count').textContent).toBe('2');
    const items = screen.getAllByTestId('ws-alert-item');
    expect(items).toHaveLength(2);
  });

  it('displays product names and SKUs in alert list', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Riz Brisé 50 kg')).toBeInTheDocument();
    });
    expect(screen.getByText('RIZ-50')).toBeInTheDocument();
    expect(screen.getByText('HUI-25')).toBeInTheDocument();
  });

  it('shows zero-stock badge for out-of-stock products', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('ws-stock-qty')).toHaveLength(2);
    });

    const badges = screen.getAllByTestId('ws-stock-qty');
    expect(badges[1]!.textContent).toBe('0 unités');
    expect(badges[1]!.classList.contains('ws-stock-badge--zero')).toBe(true);
  });

  it('shows low-stock badge for products with stock > 0', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('ws-stock-qty')).toHaveLength(2);
    });

    const badges = screen.getAllByTestId('ws-stock-qty');
    expect(badges[0]!.textContent).toBe('5 unités');
    expect(badges[0]!.classList.contains('ws-stock-badge--low')).toBe(true);
  });

  it('shows no alerts message when stock is healthy', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce({
      ...STATS_RESPONSE,
      low_stock_products: [],
    });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('ws-no-alerts')).toBeInTheDocument();
    });
  });

  /* Stock Quick-Edit ─────────────────────────────────── */

  it('opens inline stock editor on Ajuster click', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('ws-adjust-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('ws-adjust-btn')[0]!);
    expect(screen.getByTestId('ws-stock-edit')).toBeInTheDocument();
    expect(screen.getByTestId('ws-stock-input')).toHaveValue(5);
  });

  it('saves stock adjustment and reloads dashboard', async () => {
    mockFetchDashboardStats
      .mockResolvedValueOnce(STATS_RESPONSE)
      .mockResolvedValueOnce({ ...STATS_RESPONSE, low_stock_products: [] });
    mockUpdateProduct.mockResolvedValueOnce({});

    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('ws-adjust-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('ws-adjust-btn')[0]!);
    fireEvent.change(screen.getByTestId('ws-stock-input'), { target: { value: '50' } });
    fireEvent.click(screen.getByTestId('ws-stock-save'));

    await waitFor(() => {
      expect(mockUpdateProduct).toHaveBeenCalledWith('p1', { stock_qty: 50 });
    });
    expect(mockFetchDashboardStats).toHaveBeenCalledTimes(2);
  });

  it('cancels stock editing on cancel button click', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce(STATS_RESPONSE);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId('ws-adjust-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('ws-adjust-btn')[0]!);
    expect(screen.getByTestId('ws-stock-edit')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ws-stock-cancel'));
    expect(screen.queryByTestId('ws-stock-edit')).not.toBeInTheDocument();
  });

  /* Zero revenue ─────────────────────────────────────── */

  it('displays 0 F revenue when no orders today', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce({
      revenue_today_xof: 0,
      orders_today: 0,
      orders_pending: 0,
      low_stock_products: [],
    });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('ws-revenue-value')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ws-revenue-value').textContent).toMatch(/0 F/);
  });
});
