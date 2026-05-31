import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartProvider } from '../../context/CartContext.js';
import ProductDetail from '../ProductDetail.js';
import type { Product } from '../../api/client.js';

/* ── Mock API ────────────────────────────────────────── */

const mockFetchProduct = vi.fn();

vi.mock('../../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../../api/client.js')>('../../api/client.js');
  return {
    ...actual,
    fetchProduct: (...args: unknown[]) => mockFetchProduct(...args),
    // getFavorites must be mocked so loadProduct's Promise.all always resolves
    getFavorites: () => Promise.resolve([]),
  };
});

/* ── Test Data ───────────────────────────────────────── */

const fakeProduct: Product = {
  id: 'p-001',
  organization_id: 'org-aaaa-1111-2222-333344445555',
  sku: 'WAX-001',
  name: 'Tissu Wax Hollandais',
  description: 'Tissu premium importé de Hollande, motifs traditionnels.',
  price_xof: '15000',
  stock_qty: 50,
  unit: 'pagne',
  category: 'tissus',
  image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const outOfStockProduct: Product = {
  ...fakeProduct,
  id: 'p-002',
  stock_qty: 0,
};

/* ── Helper ──────────────────────────────────────────── */

function renderDetail(productId: string) {
  return render(
    <MemoryRouter initialEntries={[`/buyer/products/${productId}`]}>
      <CartProvider>
        <Routes>
          <Route path="/buyer/products/:id" element={<ProductDetail />} />
          <Route path="/buyer/catalog" element={<p data-testid="catalog-page">Catalog</p>} />
        </Routes>
      </CartProvider>
    </MemoryRouter>,
  );
}

/* ── Tests ───────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('ProductDetail — UC-10', () => {
  describe('Three-state rendering', () => {
    it('shows loading spinner while fetching', () => {
      mockFetchProduct.mockReturnValue(new Promise(() => {}));
      renderDetail('p-001');

      expect(screen.getByTestId('detail-loading')).toBeInTheDocument();
    });

    it('shows error state when product not found (404)', async () => {
      const { ApiError } = await import('../../api/client.js');
      mockFetchProduct.mockRejectedValueOnce(
        new ApiError(404, 'NOT_FOUND', 'Not found'),
      );

      renderDetail('p-invalid');

      await waitFor(() => {
        expect(screen.getByTestId('detail-error')).toBeInTheDocument();
      });

      expect(screen.getByText('Produit introuvable')).toBeInTheDocument();
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });

    it('shows error state on generic API failure', async () => {
      mockFetchProduct.mockRejectedValueOnce(new Error('Network error'));

      renderDetail('p-001');

      await waitFor(() => {
        expect(screen.getByTestId('detail-error')).toBeInTheDocument();
      });

      expect(screen.getByText(/Impossible de charger/)).toBeInTheDocument();
    });

    it('retry button refetches the product', async () => {
      mockFetchProduct
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(fakeProduct);

      renderDetail('p-001');

      await waitFor(() => {
        expect(screen.getByText('Réessayer')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText('Réessayer'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-name')).toBeInTheDocument();
      });

      expect(mockFetchProduct).toHaveBeenCalledTimes(2);
    });
  });

  describe('Product detail content', () => {
    beforeEach(async () => {
      mockFetchProduct.mockResolvedValueOnce(fakeProduct);
      renderDetail('p-001');
      await waitFor(() => {
        expect(screen.getByTestId('detail-name')).toBeInTheDocument();
      });
    });

    it('fetches product with correct ID', () => {
      expect(mockFetchProduct).toHaveBeenCalledWith('p-001');
    });

    it('displays product name', () => {
      expect(screen.getByTestId('detail-name').textContent).toBe('Tissu Wax Hollandais');
    });

    it('displays SKU', () => {
      expect(screen.getByTestId('detail-sku').textContent).toContain('WAX-001');
    });

    it('displays price formatted in XOF', () => {
      expect(screen.getByTestId('detail-price').textContent).toMatch(/15.000 F/);
    });

    it('displays description', () => {
      expect(screen.getByTestId('detail-description').textContent).toContain('Tissu premium');
    });

    it('shows in-stock badge with quantity', () => {
      expect(screen.getByTestId('detail-stock-badge').textContent).toContain('En stock');
      expect(screen.getByTestId('detail-stock-badge').textContent).toContain('50');
    });

    it('renders back link to catalog', () => {
      expect(screen.getByText(/Retour au catalogue/)).toHaveAttribute('href', '/buyer/catalog');
    });
  });

  describe('Quantity selector', () => {
    beforeEach(async () => {
      mockFetchProduct.mockResolvedValueOnce(fakeProduct);
      renderDetail('p-001');
      await waitFor(() => {
        expect(screen.getByTestId('detail-name')).toBeInTheDocument();
      });
    });

    it('starts at quantity 1', () => {
      expect(screen.getByTestId('qty-value').textContent).toBe('1');
    });

    it('increments quantity', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('qty-plus'));

      expect(screen.getByTestId('qty-value').textContent).toBe('2');
    });

    it('decrements quantity (minimum 1)', async () => {
      const user = userEvent.setup();
      // Go to 2 first
      await user.click(screen.getByTestId('qty-plus'));
      expect(screen.getByTestId('qty-value').textContent).toBe('2');

      // Decrement back to 1
      await user.click(screen.getByTestId('qty-minus'));
      expect(screen.getByTestId('qty-value').textContent).toBe('1');
    });

    it('minus button is disabled at quantity 1', () => {
      expect(screen.getByTestId('qty-minus')).toBeDisabled();
    });

    it('add-to-cart button shows dynamic total', async () => {
      const user = userEvent.setup();
      await user.click(screen.getByTestId('qty-plus'));

      // 15000 * 2 = 30000 → "30 000 F"
      expect(screen.getByTestId('add-to-cart').textContent).toMatch(/30.000 F/);
    });

    it('add-to-cart button is enabled when in stock', () => {
      expect(screen.getByTestId('add-to-cart')).not.toBeDisabled();
    });
  });

  describe('Out-of-stock product', () => {
    beforeEach(async () => {
      mockFetchProduct.mockResolvedValueOnce(outOfStockProduct);
      renderDetail('p-002');
      await waitFor(() => {
        expect(screen.getByTestId('detail-name')).toBeInTheDocument();
      });
    });

    it('shows rupture badge', () => {
      expect(screen.getByTestId('detail-stock-badge').textContent).toContain('Rupture');
    });

    it('add-to-cart button is disabled', () => {
      expect(screen.getByTestId('add-to-cart')).toBeDisabled();
      expect(screen.getByTestId('add-to-cart').textContent).toContain('Indisponible');
    });

    it('quantity buttons are disabled', () => {
      expect(screen.getByTestId('qty-minus')).toBeDisabled();
      expect(screen.getByTestId('qty-plus')).toBeDisabled();
    });
  });
});
