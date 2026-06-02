import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { CartProvider, useCart } from '../CartContext.js';
import { AuthContext } from '../../hooks/useAuth.js';
import type { Product, UserProfile } from '../../api/client.js';
import type { ReactNode } from 'react';

/* ── Test Data ───────────────────────────────────────── */

const ORG_A = 'org-aaaa-1111-2222-333344445555';
const ORG_B = 'org-bbbb-1111-2222-333344445555';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-001',
    organization_id: ORG_A,
    sku: 'WAX-001',
    name: 'Tissu Wax Hollandais',
    description: 'Tissu premium',
    price_xof: '15000',
    stock_qty: 120,
    unit: 'pagne',
    category: 'tissus',
    image_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const productA1 = makeProduct({ id: 'p-001', organization_id: ORG_A, price_xof: '15000', stock_qty: 120 });
const productA2 = makeProduct({ id: 'p-002', organization_id: ORG_A, name: 'Riz Parfumé', price_xof: '12500', stock_qty: 50 });
const productB1 = makeProduct({ id: 'p-003', organization_id: ORG_B, name: 'Savon de Marseille', price_xof: '500', stock_qty: 3000 });

/* ── Helper ──────────────────────────────────────────── */

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

/* ── Tests ───────────────────────────────────────────── */

beforeEach(() => {
  localStorage.clear();
});

describe('CartContext — UC-11', () => {
  describe('Initial state', () => {
    it('starts with empty cart', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      expect(result.current.items).toHaveLength(0);
      expect(result.current.wholesalerOrgId).toBeNull();
      expect(result.current.totalAmount).toBe(0);
      expect(result.current.itemCount).toBe(0);
    });

    it('throws when used outside CartProvider', () => {
      expect(() => {
        renderHook(() => useCart());
      }).toThrow('useCart must be used within a CartProvider');
    });
  });

  describe('addToCart', () => {
    it('adds a product to an empty cart (returns null)', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      let conflict: ReturnType<typeof result.current.addToCart>;
      act(() => {
        conflict = result.current.addToCart(productA1, 3);
      });

      expect(conflict!).toBeNull();
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.product.id).toBe('p-001');
      expect(result.current.items[0]!.quantity).toBe(3);
      expect(result.current.wholesalerOrgId).toBe(ORG_A);
    });

    it('adds a second product from the same org (no conflict)', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 2);
      });
      let conflict: ReturnType<typeof result.current.addToCart>;
      act(() => {
        conflict = result.current.addToCart(productA2, 5);
      });

      expect(conflict!).toBeNull();
      expect(result.current.items).toHaveLength(2);
    });

    it('increments quantity when adding same product again', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 2);
      });
      act(() => {
        result.current.addToCart(productA1, 3);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.quantity).toBe(5);
    });

    it('caps quantity at stock_qty when adding same product', () => {
      const product = makeProduct({ id: 'p-010', stock_qty: 10, price_xof: '1000' });
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(product, 8);
      });
      act(() => {
        result.current.addToCart(product, 5); // 8 + 5 = 13 > 10
      });

      expect(result.current.items[0]!.quantity).toBe(10);
    });
  });

  describe('Mono-wholesaler restriction', () => {
    it('returns conflict object when adding product from different org', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 1);
      });

      let conflict: ReturnType<typeof result.current.addToCart>;
      act(() => {
        conflict = result.current.addToCart(productB1, 1);
      });

      expect(conflict!).not.toBeNull();
      expect(conflict!).toEqual({
        existingOrgId: ORG_A,
        incomingOrgId: ORG_B,
      });

      // Cart must NOT have changed
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.product.id).toBe('p-001');
    });

    it('forceAddToCart clears cart and adds the new product', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 2);
        result.current.addToCart(productA2, 3);
      });

      expect(result.current.items).toHaveLength(2);

      act(() => {
        result.current.forceAddToCart(productB1, 10);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.product.id).toBe('p-003');
      expect(result.current.items[0]!.quantity).toBe(10);
      expect(result.current.wholesalerOrgId).toBe(ORG_B);
    });
  });

  describe('removeFromCart', () => {
    it('removes a specific item', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 1);
        result.current.addToCart(productA2, 1);
      });
      act(() => {
        result.current.removeFromCart('p-001');
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.product.id).toBe('p-002');
    });

    it('removing the last item resets wholesalerOrgId to null', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 1);
      });
      act(() => {
        result.current.removeFromCart('p-001');
      });

      expect(result.current.items).toHaveLength(0);
      expect(result.current.wholesalerOrgId).toBeNull();
    });
  });

  describe('updateQuantity', () => {
    it('updates quantity for a specific product', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 1);
      });
      act(() => {
        result.current.updateQuantity('p-001', 10);
      });

      expect(result.current.items[0]!.quantity).toBe(10);
    });

    it('clamps quantity to [1, stock_qty]', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 5); // stock_qty = 120
      });
      act(() => {
        result.current.updateQuantity('p-001', 0); // below min
      });
      expect(result.current.items[0]!.quantity).toBe(1);

      act(() => {
        result.current.updateQuantity('p-001', 999); // above stock
      });
      expect(result.current.items[0]!.quantity).toBe(120);
    });
  });

  describe('clearCart', () => {
    it('removes all items', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 1);
        result.current.addToCart(productA2, 2);
      });
      act(() => {
        result.current.clearCart();
      });

      expect(result.current.items).toHaveLength(0);
      expect(result.current.wholesalerOrgId).toBeNull();
      expect(result.current.totalAmount).toBe(0);
    });
  });

  describe('Computed values', () => {
    it('computes totalAmount correctly', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 2); // 15000 * 2 = 30000
        result.current.addToCart(productA2, 3); // 12500 * 3 = 37500
      });

      expect(result.current.totalAmount).toBe(67500);
    });

    it('computes itemCount correctly', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 2);
        result.current.addToCart(productA2, 3);
      });

      expect(result.current.itemCount).toBe(5);
    });
  });

  describe('localStorage persistence', () => {
    it('persists cart to localStorage', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addToCart(productA1, 3);
      });

      const stored = JSON.parse(localStorage.getItem('marchelink_cart')!);
      expect(stored).toHaveLength(1);
      expect(stored[0].product.id).toBe('p-001');
      expect(stored[0].quantity).toBe(3);
    });

    it('restores cart from localStorage on mount', () => {
      const initial = [{ product: productA1, quantity: 5 }];
      localStorage.setItem('marchelink_cart', JSON.stringify(initial));

      const { result } = renderHook(() => useCart(), { wrapper });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.quantity).toBe(5);
      expect(result.current.wholesalerOrgId).toBe(ORG_A);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('marchelink_cart', '{bad json');

      const { result } = renderHook(() => useCart(), { wrapper });

      expect(result.current.items).toHaveLength(0);
    });
  });

  describe('Vidage à la déconnexion (appareil partagé)', () => {
    function makeUser(id: string): UserProfile {
      return {
        id,
        email: `${id}@test.ci`,
        role: 'buyer',
        organization_id: null,
        first_name: 'Test',
        last_name: 'User',
        phone: null,
        profile_photo: null,
      };
    }

    function makeAuthValue(user: UserProfile | null) {
      return {
        user,
        loading: false,
        error: null,
        isAuthenticated: user !== null,
        login: async () => {},
        register: async () => {},
        registerWholesaler: async () => {},
        logout: async () => {},
        reloadUser: async () => {},
      };
    }

    it('vide le panier à la déconnexion (A → null)', () => {
      let authValue = makeAuthValue(makeUser('user-A'));
      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <AuthContext.Provider value={authValue}>
            <CartProvider>{children}</CartProvider>
          </AuthContext.Provider>
        );
      }
      const { result, rerender } = renderHook(() => useCart(), { wrapper: Wrapper });

      act(() => {
        result.current.addToCart(productA1, 2);
      });
      expect(result.current.items).toHaveLength(1);

      authValue = makeAuthValue(null);
      rerender();

      expect(result.current.items).toHaveLength(0);
      expect(localStorage.getItem('marchelink_cart')).toBe('[]');
    });

    it('vide le panier au changement de compte (A → B)', () => {
      let authValue = makeAuthValue(makeUser('user-A'));
      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <AuthContext.Provider value={authValue}>
            <CartProvider>{children}</CartProvider>
          </AuthContext.Provider>
        );
      }
      const { result, rerender } = renderHook(() => useCart(), { wrapper: Wrapper });

      act(() => {
        result.current.addToCart(productA1, 1);
      });
      expect(result.current.items).toHaveLength(1);

      authValue = makeAuthValue(makeUser('user-B'));
      rerender();

      expect(result.current.items).toHaveLength(0);
    });

    it('conserve le panier à la 1ʳᵉ connexion (null → A)', () => {
      let authValue = makeAuthValue(null);
      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <AuthContext.Provider value={authValue}>
            <CartProvider>{children}</CartProvider>
          </AuthContext.Provider>
        );
      }
      const { result, rerender } = renderHook(() => useCart(), { wrapper: Wrapper });

      act(() => {
        result.current.addToCart(productA1, 3);
      });
      expect(result.current.items).toHaveLength(1);

      // Connexion initiale : on NE vide PAS (l'utilisateur garde son panier).
      authValue = makeAuthValue(makeUser('user-A'));
      rerender();

      expect(result.current.items).toHaveLength(1);
    });
  });
});
