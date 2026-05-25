import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import type { Product } from '../api/client.js';

/* ── Types ──────────────────────────────────────────── */

export interface CartItem {
  product: Product;
  quantity: number;
}

/** Returned by addToCart when a mono-wholesaler conflict is detected */
export interface CartConflict {
  existingOrgId: string;
  incomingOrgId: string;
}

export interface CartContextValue {
  items: CartItem[];
  /** org_id of the current cart's wholesaler, or null if empty */
  wholesalerOrgId: string | null;
  totalAmount: number;
  itemCount: number;

  /**
   * Add a product to the cart.
   * Returns `null` on success, or a `CartConflict` if the product
   * belongs to a different wholesaler than the existing cart items.
   * The UI is then responsible for showing a confirmation dialog.
   */
  addToCart: (product: Product, quantity: number) => CartConflict | null;

  /** Force-add after user confirms cart clear on conflict */
  forceAddToCart: (product: Product, quantity: number) => void;

  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

/* ── Storage key ────────────────────────────────────── */

const STORAGE_KEY = 'marchelink_cart';

/* ── Helpers ────────────────────────────────────────── */

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveCartToStorage(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ── Context ────────────────────────────────────────── */

const CartContext = createContext<CartContextValue | null>(null);

/* ── Provider ───────────────────────────────────────── */

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());

  /* Persist to localStorage on every change */
  useEffect(() => {
    saveCartToStorage(items);
  }, [items]);

  /* Derived: current wholesaler org */
  const wholesalerOrgId = useMemo(() => {
    if (items.length === 0) return null;
    return items[0]!.product.organization_id;
  }, [items]);

  /* Derived: total in XOF */
  const totalAmount = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.product.price_xof) * item.quantity,
        0,
      ),
    [items],
  );

  /* Derived: total item count */
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  /* ── addToCart — returns conflict or null ──────────── */

  const addToCart = useCallback(
    (product: Product, quantity: number): CartConflict | null => {
      /* Mono-wholesaler check */
      if (
        wholesalerOrgId &&
        product.organization_id !== wholesalerOrgId
      ) {
        return {
          existingOrgId: wholesalerOrgId,
          incomingOrgId: product.organization_id,
        };
      }

      setItems((prev) => {
        const idx = prev.findIndex((i) => i.product.id === product.id);
        if (idx >= 0) {
          const updated = [...prev];
          const existing = updated[idx]!;
          const newQty = Math.min(
            existing.quantity + quantity,
            product.stock_qty,
          );
          updated[idx] = { ...existing, quantity: newQty };
          return updated;
        }
        return [...prev, { product, quantity }];
      });

      return null;
    },
    [wholesalerOrgId],
  );

  /* ── forceAddToCart — clear + add (after conflict confirm) */

  const forceAddToCart = useCallback(
    (product: Product, quantity: number): void => {
      setItems([{ product, quantity }]);
    },
    [],
  );

  /* ── removeFromCart ────────────────────────────────── */

  const removeFromCart = useCallback((productId: string): void => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  /* ── updateQuantity ───────────────────────────────── */

  const updateQuantity = useCallback(
    (productId: string, quantity: number): void => {
      setItems((prev) =>
        prev.map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: Math.max(1, Math.min(quantity, item.product.stock_qty)),
              }
            : item,
        ),
      );
    },
    [],
  );

  /* ── clearCart ─────────────────────────────────────── */

  const clearCart = useCallback((): void => {
    setItems([]);
  }, []);

  /* ── Value ─────────────────────────────────────────── */

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      wholesalerOrgId,
      totalAmount,
      itemCount,
      addToCart,
      forceAddToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
    }),
    [
      items,
      wholesalerOrgId,
      totalAmount,
      itemCount,
      addToCart,
      forceAddToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/* ── Hook ───────────────────────────────────────────── */

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
