import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartProvider } from '../../context/CartContext.js';
import BuyerFavorites from '../BuyerFavorites.js';
import type { FavoriteItem } from '../../api/client.js';

/* ── Mock API ────────────────────────────────────────── */

const mockGetFavorites = vi.fn();
const mockRemoveFavorite = vi.fn();

vi.mock('../../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../../api/client.js')>('../../api/client.js');
  return {
    ...actual,
    getFavorites: (...args: unknown[]) => mockGetFavorites(...args),
    removeFavorite: (...args: unknown[]) => mockRemoveFavorite(...args),
    ApiError: class ApiError extends Error {
      status: number; code: string;
      constructor(status: number, code: string, message: string) {
        super(message); this.status = status; this.code = code; this.name = 'ApiError';
      }
    },
  };
});

/* ── Fixtures ────────────────────────────────────────── */

const FAV_A: FavoriteItem = {
  id: 'fav-001',
  product_id: 'p-001',
  product_name: 'Tissu Wax Hollandais',
  product_sku: 'WAX-001',
  product_price_xof: '15000',
  product_stock_qty: 100,
  product_unit: 'pagne',
  product_category: 'tissus',
  product_image_url: null,
  product_organization_id: 'org-a',
  org_name: "Tissus d'Aya",
  created_at: '2026-01-01T00:00:00Z',
};

const FAV_B: FavoriteItem = {
  ...FAV_A,
  id: 'fav-002',
  product_id: 'p-002',
  product_name: 'Poivre Noir 1kg',
  product_sku: 'POI-001',
  product_price_xof: '3000',
  product_stock_qty: 0, // out of stock
  product_unit: 'kg',
  product_category: 'epices',
};

/* ── Helper ──────────────────────────────────────────── */

function renderFavorites() {
  return render(
    <MemoryRouter>
      <CartProvider>
        <BuyerFavorites />
      </CartProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ── Tests ───────────────────────────────────────────── */

describe('BuyerFavorites — UC-F1', () => {
  describe('États de chargement', () => {
    it('affiche le skeleton pendant le chargement initial', () => {
      mockGetFavorites.mockReturnValue(new Promise(() => {}));
      renderFavorites();
      expect(screen.getByTestId('favorites-loading')).toBeInTheDocument();
    });

    it('affiche l\'erreur avec bouton Réessayer en cas d\'échec', async () => {
      mockGetFavorites.mockRejectedValueOnce(new Error('Erreur réseau'));
      renderFavorites();
      await waitFor(() => expect(screen.getByTestId('favorites-error')).toBeInTheDocument());
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });
  });

  describe('État vide', () => {
    it('affiche l\'état vide si aucun favori', async () => {
      mockGetFavorites.mockResolvedValue([]);
      renderFavorites();
      await waitFor(() => expect(screen.getByTestId('favorites-empty')).toBeInTheDocument());
      expect(screen.getByText('Aucun favori pour l\'instant')).toBeInTheDocument();
      expect(screen.getByText('Parcourir le catalogue')).toBeInTheDocument();
    });
  });

  describe('Affichage des favoris', () => {
    beforeEach(async () => {
      mockGetFavorites.mockResolvedValue([FAV_A, FAV_B]);
      renderFavorites();
      await waitFor(() => expect(screen.getByTestId('favorites-grid')).toBeInTheDocument());
    });

    it('affiche les cartes pour chaque favori', () => {
      expect(screen.getAllByTestId('fav-card')).toHaveLength(2);
    });

    it('affiche le nom et l\'organisation', () => {
      expect(screen.getByText('Tissu Wax Hollandais')).toBeInTheDocument();
      expect(screen.getByText('Poivre Noir 1kg')).toBeInTheDocument();
      expect(screen.getByText("Tissus d'Aya · Tissus")).toBeInTheDocument();
    });

    it('désactive le bouton Ajouter pour un produit en rupture', () => {
      const addBtns = screen.getAllByTestId('fav-add-to-cart');
      expect(addBtns[0]).not.toBeDisabled(); // FAV_A in stock
      expect(addBtns[1]).toBeDisabled();     // FAV_B out of stock
    });

    it('les cartes pointent vers /buyer/products/:id', () => {
      const cards = screen.getAllByTestId('fav-card');
      expect(cards[0]!.querySelector('a')!.getAttribute('href')).toBe('/buyer/products/p-001');
    });
  });

  describe('Retirer un favori', () => {
    it('retire la carte de la liste après clic sur ♥', async () => {
      mockGetFavorites.mockResolvedValue([FAV_A]);
      mockRemoveFavorite.mockResolvedValue(undefined);
      renderFavorites();
      await waitFor(() => expect(screen.getByTestId('fav-remove')).toBeInTheDocument());
      const user = userEvent.setup();
      await user.click(screen.getByTestId('fav-remove'));
      await waitFor(() =>
        expect(mockRemoveFavorite).toHaveBeenCalledWith('p-001'),
      );
      await waitFor(() => expect(screen.getByTestId('favorites-empty')).toBeInTheDocument());
    });
  });

  describe('Ajouter au panier (1 clic)', () => {
    it('ajoute le produit au panier en 1 clic', async () => {
      mockGetFavorites.mockResolvedValue([FAV_A]);
      renderFavorites();
      await waitFor(() => expect(screen.getByTestId('fav-add-to-cart')).toBeInTheDocument());
      const user = userEvent.setup();
      await user.click(screen.getByTestId('fav-add-to-cart'));
      // No conflict expected (cart was empty) — no modal visible
      expect(screen.queryByTestId('fav-conflict-modal')).not.toBeInTheDocument();
    });
  });
});
