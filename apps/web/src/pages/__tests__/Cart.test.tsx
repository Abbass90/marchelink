import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartProvider } from '../../context/CartContext.js';
import Cart from '../Cart.js';
import type { Product } from '../../api/client.js';

/* ── Mock API ────────────────────────────────────────── */

const mockPlaceOrder = vi.fn();

vi.mock('../../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../../api/client.js')>('../../api/client.js');
  return {
    ...actual,
    placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
  };
});

/* ── Test Data ───────────────────────────────────────── */

const ORG_A = 'org-aaaa-1111-2222-333344445555';

const productA1: Product = {
  id: 'p-001',
  organization_id: ORG_A,
  sku: 'WAX-001',
  name: 'Tissu Wax Hollandais',
  description: 'Tissu premium',
  price_xof: '15000',
  stock_qty: 120,
  unit: 'pagne',
  image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const productA2: Product = {
  id: 'p-002',
  organization_id: ORG_A,
  sku: 'RIZ-001',
  name: 'Riz Parfumé 25kg',
  description: null,
  price_xof: '12500',
  stock_qty: 50,
  unit: 'sac',
  image_url: 'https://img.example.com/riz.jpg',
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

/* ── Helpers ─────────────────────────────────────────── */

function seedCart(items: Array<{ product: Product; quantity: number }>) {
  localStorage.setItem('marchelink_cart', JSON.stringify(items));
}

function renderCart() {
  return render(
    <MemoryRouter initialEntries={['/buyer/cart']}>
      <CartProvider>
        <Routes>
          <Route path="/buyer/cart" element={<Cart />} />
          <Route
            path="/buyer/order-confirmation/:id"
            element={<p data-testid="confirmation-page">Confirmed</p>}
          />
          <Route
            path="/buyer/catalog"
            element={<p data-testid="catalog-page">Catalog</p>}
          />
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

describe('Cart Page — UC-11 / UC-12', () => {
  describe('Empty cart state', () => {
    it('shows empty cart message when no items', () => {
      renderCart();

      expect(screen.getByTestId('cart-empty')).toBeInTheDocument();
      expect(screen.getByText('Votre panier est vide')).toBeInTheDocument();
    });

    it('provides link to catalog', () => {
      renderCart();

      expect(screen.getByText('Voir le catalogue')).toHaveAttribute('href', '/buyer/catalog');
    });
  });

  describe('Cart with items', () => {
    beforeEach(() => {
      seedCart([
        { product: productA1, quantity: 2 },
        { product: productA2, quantity: 3 },
      ]);
    });

    it('renders all cart items', () => {
      renderCart();

      const items = screen.getAllByTestId('cart-item');
      expect(items).toHaveLength(2);
      expect(screen.getByText('Tissu Wax Hollandais')).toBeInTheDocument();
      expect(screen.getByText('Riz Parfumé 25kg')).toBeInTheDocument();
    });

    it('displays item count and wholesaler', () => {
      renderCart();

      const countEl = screen.getByTestId('cart-count');
      expect(countEl.textContent).toContain('5 articles');
      expect(countEl.textContent).toContain('org-aaaa');
    });

    it('displays line totals for each item', () => {
      renderCart();

      // 15000 * 2 = 30000
      expect(screen.getByTestId('line-total-p-001').textContent).toMatch(/30.000 F/);
      // 12500 * 3 = 37500
      expect(screen.getByTestId('line-total-p-002').textContent).toMatch(/37.500 F/);
    });

    it('displays cart total', () => {
      renderCart();

      // 30000 + 37500 = 67500
      expect(screen.getByTestId('cart-total').textContent).toMatch(/67.500 F/);
    });

    it('displays quantity values', () => {
      renderCart();

      expect(screen.getByTestId('qty-value-p-001').textContent).toBe('2');
      expect(screen.getByTestId('qty-value-p-002').textContent).toBe('3');
    });
  });

  describe('Quantity controls', () => {
    beforeEach(() => {
      seedCart([{ product: productA1, quantity: 5 }]);
    });

    it('increments quantity', async () => {
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('qty-plus-p-001'));

      expect(screen.getByTestId('qty-value-p-001').textContent).toBe('6');
    });

    it('decrements quantity', async () => {
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('qty-minus-p-001'));

      expect(screen.getByTestId('qty-value-p-001').textContent).toBe('4');
    });

    it('minus is disabled at quantity 1', () => {
      seedCart([{ product: productA1, quantity: 1 }]);
      renderCart();

      expect(screen.getByTestId('qty-minus-p-001')).toBeDisabled();
    });

    it('plus is disabled at max stock', () => {
      seedCart([{ product: productA1, quantity: 120 }]); // stock_qty = 120
      renderCart();

      expect(screen.getByTestId('qty-plus-p-001')).toBeDisabled();
    });
  });

  describe('Remove items', () => {
    it('removes a specific item from cart', async () => {
      seedCart([
        { product: productA1, quantity: 1 },
        { product: productA2, quantity: 1 },
      ]);
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('remove-p-001'));

      const items = screen.getAllByTestId('cart-item');
      expect(items).toHaveLength(1);
      expect(screen.getByText('Riz Parfumé 25kg')).toBeInTheDocument();
    });

    it('shows empty state after removing last item', async () => {
      seedCart([{ product: productA1, quantity: 1 }]);
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('remove-p-001'));

      expect(screen.getByTestId('cart-empty')).toBeInTheDocument();
    });
  });

  describe('Checkout flow', () => {
    beforeEach(() => {
      seedCart([
        { product: productA1, quantity: 2 },
        { product: productA2, quantity: 1 },
      ]);
    });

    it('renders checkout button with total', () => {
      renderCart();

      const btn = screen.getByTestId('checkout-btn');
      expect(btn.textContent).toMatch(/42.500 F/); // 30000 + 12500
    });

    it('calls placeOrder with correct payload on checkout', async () => {
      mockPlaceOrder.mockResolvedValueOnce({
        id: 'order-1234',
        total_xof: '42500',
        items: [],
      });
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('checkout-btn'));

      await waitFor(() => {
        expect(mockPlaceOrder).toHaveBeenCalledWith({
          wholesaler_org_id: ORG_A,
          items: [
            { product_id: 'p-001', quantity: 2 },
            { product_id: 'p-002', quantity: 1 },
          ],
        });
      });
    });

    it('redirects to confirmation page on success', async () => {
      mockPlaceOrder.mockResolvedValueOnce({
        id: 'order-1234',
        total_xof: '42500',
        items: [],
      });
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('checkout-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('confirmation-page')).toBeInTheDocument();
      });
    });

    it('clears cart after successful order', async () => {
      mockPlaceOrder.mockResolvedValueOnce({
        id: 'order-1234',
        total_xof: '42500',
        items: [],
      });
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('checkout-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('confirmation-page')).toBeInTheDocument();
      });

      const stored = JSON.parse(localStorage.getItem('marchelink_cart')!);
      expect(stored).toHaveLength(0);
    });

    it('shows error message on API failure', async () => {
      mockPlaceOrder.mockRejectedValueOnce(new Error('Network error'));
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('checkout-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('cart-error')).toBeInTheDocument();
      });
      expect(screen.getByText('Impossible de placer la commande')).toBeInTheDocument();
    });

    it('shows API error message', async () => {
      const { ApiError } = await import('../../api/client.js');
      mockPlaceOrder.mockRejectedValueOnce(
        new ApiError(422, 'VALIDATION', 'Stock insuffisant'),
      );
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('checkout-btn'));

      await waitFor(() => {
        expect(screen.getByText('Stock insuffisant')).toBeInTheDocument();
      });
    });

    it('disables checkout button while submitting', async () => {
      mockPlaceOrder.mockReturnValue(new Promise(() => {})); // never resolves
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('checkout-btn'));

      expect(screen.getByTestId('checkout-btn')).toBeDisabled();
      expect(screen.getByTestId('checkout-btn').textContent).toContain('Envoi en cours');
    });

    it('re-enables button after API failure', async () => {
      mockPlaceOrder.mockRejectedValueOnce(new Error('fail'));
      renderCart();
      const user = userEvent.setup();

      await user.click(screen.getByTestId('checkout-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('checkout-btn')).not.toBeDisabled();
      });
    });
  });
});
