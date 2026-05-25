import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BuyerCatalog from '../BuyerCatalog.js';
import type { PaginatedProducts } from '../../api/client.js';

/* ── Mock API ────────────────────────────────────────── */

const mockFetchProducts = vi.fn();

vi.mock('../../api/client.js', () => ({
  fetchProducts: (...args: unknown[]) => mockFetchProducts(...args),
  ApiError: class ApiError extends Error {
    status: number; code: string;
    constructor(status: number, code: string, message: string) {
      super(message); this.status = status; this.code = code; this.name = 'ApiError';
    }
  },
}));

/* ── Fixtures ────────────────────────────────────────── */

const PRODUCT_A = {
  id: 'p-001', organization_id: 'org-a', org_name: "Tissus d'Aya",
  sku: 'WAX-001', name: 'Tissu Wax Hollandais', description: 'Tissu premium',
  price_xof: '15000', stock_qty: 120, unit: 'pagne', image_url: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const PRODUCT_B = {
  id: 'p-002', organization_id: 'org-a', org_name: "Tissus d'Aya",
  sku: 'RIZ-001', name: 'Riz Parfumé 25kg', description: null,
  price_xof: '12500', stock_qty: 0, unit: 'sac', image_url: null,
  created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
};

const PRODUCT_C = {
  id: 'p-003', organization_id: 'org-b', org_name: 'Épices Adjoua',
  sku: 'SAVON-01', name: 'Savon de Marseille', description: null,
  price_xof: '500', stock_qty: 3000, unit: 'unité', image_url: null,
  created_at: '2026-01-03T00:00:00Z', updated_at: '2026-01-03T00:00:00Z',
};

function makePage(products = [PRODUCT_A, PRODUCT_B, PRODUCT_C], total?: number): PaginatedProducts {
  return { data: products, total: total ?? products.length, page: 1, limit: 12 };
}

const EMPTY_PAGE: PaginatedProducts = { data: [], total: 0, page: 1, limit: 12 };

/* ── Helper ──────────────────────────────────────────── */

function renderCatalog() {
  return render(
    <MemoryRouter initialEntries={['/buyer/catalog']}>
      <BuyerCatalog />
    </MemoryRouter>,
  );
}

/* ── Setup ───────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
});

/* ── Tests ───────────────────────────────────────────── */

describe('BuyerCatalog — UC-09', () => {
  describe('États de chargement', () => {
    it('affiche le skeleton pendant le chargement initial', () => {
      mockFetchProducts.mockReturnValue(new Promise(() => {}));
      renderCatalog();
      expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();
    });

    it('affiche l\'erreur avec bouton Réessayer en cas d\'échec', async () => {
      mockFetchProducts.mockRejectedValueOnce(new Error('Network error'));
      renderCatalog();
      await waitFor(() => expect(screen.getByTestId('catalog-error')).toBeInTheDocument());
      expect(screen.getByText(/Impossible de charger/)).toBeInTheDocument();
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });

    it('affiche la grille de produits après chargement réussi', async () => {
      mockFetchProducts.mockResolvedValue(makePage());
      renderCatalog();
      await waitFor(() => expect(screen.getByTestId('catalog-grid')).toBeInTheDocument());
      expect(screen.getAllByTestId('catalog-card')).toHaveLength(3);
    });
  });

  describe('Contenu des cartes produit', () => {
    beforeEach(async () => {
      mockFetchProducts.mockResolvedValue(makePage());
      renderCatalog();
      await waitFor(() => expect(screen.getByTestId('catalog-grid')).toBeInTheDocument());
    });

    it('affiche les noms des produits', () => {
      expect(screen.getByText('Tissu Wax Hollandais')).toBeInTheDocument();
      expect(screen.getByText('Riz Parfumé 25kg')).toBeInTheDocument();
    });

    it('affiche le nom de l\'organisation (org_name) à la place de l\'UUID', () => {
      expect(screen.getAllByText("Tissus d'Aya")).toHaveLength(2);
      expect(screen.getByText('Épices Adjoua')).toBeInTheDocument();
    });

    it('affiche le badge En stock pour les produits disponibles', () => {
      expect(screen.getAllByTestId('badge-in-stock')).toHaveLength(2);
    });

    it('affiche le badge Rupture pour les produits épuisés', () => {
      expect(screen.getAllByTestId('badge-out')).toHaveLength(1);
    });

    it('affiche le prix formaté en XOF', () => {
      expect(screen.getByText(/15.000 F/)).toBeInTheDocument();
    });

    it('affiche le total de produits', () => {
      expect(screen.getByTestId('catalog-count').textContent).toContain('3 produits');
    });

    it('les cartes pointent vers /buyer/products/:id', () => {
      const cards = screen.getAllByTestId('catalog-card');
      expect(cards[0]).toHaveAttribute('href', '/buyer/products/p-001');
      expect(cards[2]).toHaveAttribute('href', '/buyer/products/p-003');
    });
  });

  describe('Filtres — appels API avec les bons params', () => {
    beforeEach(async () => {
      mockFetchProducts.mockResolvedValue(makePage());
      renderCatalog();
      await waitFor(() => expect(screen.getByTestId('catalog-grid')).toBeInTheDocument());
    });

    it('la recherche déclenche un appel API avec le param q (après debounce)', async () => {
      mockFetchProducts.mockClear();
      mockFetchProducts.mockResolvedValue(makePage([PRODUCT_A]));
      const user = userEvent.setup();
      await user.type(screen.getByTestId('catalog-search'), 'Wax');
      await waitFor(
        () => expect(mockFetchProducts).toHaveBeenCalledWith(expect.objectContaining({ q: 'Wax' })),
        { timeout: 1500 },
      );
    });

    it('le toggle En stock appelle l\'API avec in_stock: true', async () => {
      mockFetchProducts.mockClear();
      mockFetchProducts.mockResolvedValue(makePage([PRODUCT_A, PRODUCT_C]));
      const user = userEvent.setup();
      await user.click(screen.getByTestId('catalog-in-stock'));
      await waitFor(() =>
        expect(mockFetchProducts).toHaveBeenCalledWith(expect.objectContaining({ in_stock: true })),
      );
    });

    it('le select tri appelle l\'API avec le bon sort', async () => {
      mockFetchProducts.mockClear();
      mockFetchProducts.mockResolvedValue(makePage());
      const user = userEvent.setup();
      await user.selectOptions(screen.getByTestId('catalog-sort'), 'price_asc');
      await waitFor(() =>
        expect(mockFetchProducts).toHaveBeenCalledWith(expect.objectContaining({ sort: 'price_asc' })),
      );
    });

    it('le filtre prix min appelle l\'API avec min_price', async () => {
      mockFetchProducts.mockClear();
      mockFetchProducts.mockResolvedValue(makePage([PRODUCT_A]));
      const user = userEvent.setup();
      await user.type(screen.getByTestId('catalog-min-price'), '10000');
      await waitFor(() =>
        expect(mockFetchProducts).toHaveBeenCalledWith(expect.objectContaining({ min_price: 10000 })),
      );
    });
  });

  describe('Pagination', () => {
    it('affiche les boutons Précédent/Suivant quand total > PAGE_SIZE', async () => {
      mockFetchProducts.mockResolvedValue(makePage([PRODUCT_A, PRODUCT_B], 25));
      renderCatalog();
      await waitFor(() => expect(screen.getByTestId('catalog-pagination')).toBeInTheDocument());
      expect(screen.getByTestId('catalog-prev')).toBeDisabled();
      expect(screen.getByTestId('catalog-next')).not.toBeDisabled();
    });

    it('n\'affiche pas la pagination quand tout tient sur une page', async () => {
      mockFetchProducts.mockResolvedValue(makePage());
      renderCatalog();
      await waitFor(() => expect(screen.getByTestId('catalog-grid')).toBeInTheDocument());
      expect(screen.queryByTestId('catalog-pagination')).not.toBeInTheDocument();
    });

    it('clic Suivant appelle l\'API avec page=2', async () => {
      mockFetchProducts.mockResolvedValue(makePage([PRODUCT_A, PRODUCT_B], 25));
      renderCatalog();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId('catalog-next')).toBeInTheDocument());
      mockFetchProducts.mockClear();
      mockFetchProducts.mockResolvedValue(makePage([PRODUCT_C], 25));
      await user.click(screen.getByTestId('catalog-next'));
      await waitFor(() =>
        expect(mockFetchProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })),
      );
    });
  });

  describe('État vide', () => {
    it('affiche l\'état vide si aucun produit retourné', async () => {
      mockFetchProducts.mockResolvedValue(EMPTY_PAGE);
      renderCatalog();
      await waitFor(() => expect(screen.getByTestId('catalog-empty')).toBeInTheDocument());
      expect(screen.getByText('Aucun produit trouvé')).toBeInTheDocument();
    });
  });
});
