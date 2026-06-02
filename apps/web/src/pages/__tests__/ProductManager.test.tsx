import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProductManager from '../ProductManager.js';

/* ── Mocks ──────────────────────────────────────────── */

const mockFetchMyProducts = vi.fn();
const mockCreateProduct = vi.fn();
const mockUpdateProduct = vi.fn();
const mockDeleteProduct = vi.fn();

vi.mock('../../api/client.js', () => ({
  fetchMyProducts: (...args: unknown[]) => mockFetchMyProducts(...args),
  createProduct: (...args: unknown[]) => mockCreateProduct(...args),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
  deleteProduct: (...args: unknown[]) => mockDeleteProduct(...args),
}));

/* ── Helpers ────────────────────────────────────────── */

function renderManager() {
  return render(
    <MemoryRouter initialEntries={['/wholesaler/products']}>
      <Routes>
        <Route path="/wholesaler/products" element={<ProductManager />} />
        <Route path="/wholesaler" element={<p data-testid="ws-dashboard">Dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const PRODUCTS = [
  {
    id: 'p1',
    organization_id: 'org-1',
    sku: 'RIZ-50',
    name: 'Riz Brisé 50 kg',
    description: 'Riz de qualité',
    price_xof: '18500',
    stock_qty: 120,
    unit: 'sac',
    image_url: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'p2',
    organization_id: 'org-1',
    sku: 'HUI-25',
    name: 'Huile Palme 25 L',
    description: null,
    price_xof: '32000',
    stock_qty: 3,
    unit: 'bidon',
    image_url: 'https://img.test/huile.jpg',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  },
];

/* ── Tests ──────────────────────────────────────────── */

describe('ProductManager — UC-01, UC-02', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* Loading ──────────────────────────────────────────── */

  it('shows loading state while fetching products', () => {
    mockFetchMyProducts.mockReturnValue(new Promise(() => {}));
    renderManager();
    expect(screen.getByTestId('pm-loading')).toBeInTheDocument();
  });

  /* Error + Retry ───────────────────────────────────── */

  it('shows error state and retry button on failure', async () => {
    mockFetchMyProducts.mockRejectedValueOnce(new Error('Server error'));
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('retries on retry button click', async () => {
    mockFetchMyProducts
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(PRODUCTS);

    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-retry-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-retry-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('pm-product-list')).toBeInTheDocument();
    });
  });

  /* Empty State ──────────────────────────────────────── */

  it('shows empty state when catalog is empty', async () => {
    mockFetchMyProducts.mockResolvedValueOnce([]);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('Votre catalogue est vide.')).toBeInTheDocument();
  });

  /* Product Table ────────────────────────────────────── */

  it('renders product list with correct data', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-product-list')).toBeInTheDocument();
    });

    const rows = screen.getAllByTestId('pm-product-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('RIZ-50')).toBeInTheDocument();
    expect(screen.getByText('Riz Brisé 50 kg')).toBeInTheDocument();
    expect(screen.getByText('Huile Palme 25 L')).toBeInTheDocument();
  });

  it('formats prices in XOF', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-product-list')).toBeInTheDocument();
    });

    expect(screen.getByText(/18.500 F/)).toBeInTheDocument();
    expect(screen.getByText(/32.000 F/)).toBeInTheDocument();
  });

  it('shows stock badges with correct severity', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getAllByTestId('pm-stock-badge')).toHaveLength(2);
    });

    const badges = screen.getAllByTestId('pm-stock-badge');
    expect(badges[0]!.textContent).toBe('120');
    expect(badges[0]!.classList.contains('ws-stock-badge--ok')).toBe(true);
    expect(badges[1]!.textContent).toBe('3');
    expect(badges[1]!.classList.contains('ws-stock-badge--low')).toBe(true);
  });

  it('displays product count in subtitle', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByText('2 produits')).toBeInTheDocument();
    });
  });

  /* Create Modal ─────────────────────────────────────── */

  it('opens create modal on add button click', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));
    expect(screen.getByTestId('pm-modal')).toBeInTheDocument();
    expect(screen.getByTestId('pm-modal-title').textContent).toBe('Nouveau produit');
  });

  it('closes modal on cancel', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));
    expect(screen.getByTestId('pm-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pm-cancel-btn'));
    expect(screen.queryByTestId('pm-modal')).not.toBeInTheDocument();
  });

  /* Form Validation — blur ───────────────────────────── */

  it('shows validation error on blur for empty required fields', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));

    fireEvent.focus(screen.getByTestId('pm-field-sku'));
    fireEvent.blur(screen.getByTestId('pm-field-sku'));
    expect(screen.getByTestId('pm-error-sku')).toBeInTheDocument();

    fireEvent.focus(screen.getByTestId('pm-field-name'));
    fireEvent.blur(screen.getByTestId('pm-field-name'));
    expect(screen.getByTestId('pm-error-name')).toBeInTheDocument();
  });

  it('validates price must be positive integer', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));

    fireEvent.change(screen.getByTestId('pm-field-price'), { target: { value: '-5' } });
    fireEvent.blur(screen.getByTestId('pm-field-price'));
    expect(screen.getByTestId('pm-error-price')).toBeInTheDocument();
    expect(screen.getByTestId('pm-error-price').textContent).toBe('Prix entier positif requis');
  });

  it('validates stock must be non-negative integer', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));

    fireEvent.change(screen.getByTestId('pm-field-stock'), { target: { value: '-1' } });
    fireEvent.blur(screen.getByTestId('pm-field-stock'));
    expect(screen.getByTestId('pm-error-stock')).toBeInTheDocument();
    expect(screen.getByTestId('pm-error-stock').textContent).toBe('Stock entier positif requis');
  });

  it('affiche le bouton photo dans le formulaire produit', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));
    // Le composant ProductImageUpload remplace le champ URL texte
    expect(screen.getByTestId('pm-image-upload-btn')).toBeInTheDocument();
    expect(screen.getByTestId('pm-image-upload-btn').textContent).toContain('Choisir une photo');
  });

  /* Form Submit — Create ─────────────────────────────── */

  it('creates product via API and reloads list on success', async () => {
    mockFetchMyProducts
      .mockResolvedValueOnce(PRODUCTS)
      .mockResolvedValueOnce([...PRODUCTS, { ...PRODUCTS[0]!, id: 'p3', sku: 'SUC-10', name: 'Sucre 10 kg' }]);
    mockCreateProduct.mockResolvedValueOnce({ id: 'p3' });

    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));

    fireEvent.change(screen.getByTestId('pm-field-sku'), { target: { value: 'SUC-10' } });
    fireEvent.change(screen.getByTestId('pm-field-name'), { target: { value: 'Sucre 10 kg' } });
    fireEvent.change(screen.getByTestId('pm-field-price'), { target: { value: '8500' } });
    fireEvent.change(screen.getByTestId('pm-field-stock'), { target: { value: '100' } });

    fireEvent.click(screen.getByTestId('pm-submit-btn'));

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        sku: 'SUC-10',
        name: 'Sucre 10 kg',
        category: 'autre',
        description: undefined,
        price_xof: 8500,
        stock_qty: 100,
        unit: 'unité',
        image_url: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('pm-modal')).not.toBeInTheDocument();
    });
  });

  it('shows submit error banner on API failure', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    mockCreateProduct.mockRejectedValueOnce(new Error('Duplicate SKU'));

    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));

    fireEvent.change(screen.getByTestId('pm-field-sku'), { target: { value: 'RIZ-50' } });
    fireEvent.change(screen.getByTestId('pm-field-name'), { target: { value: 'Duplicate' } });
    fireEvent.change(screen.getByTestId('pm-field-price'), { target: { value: '1000' } });
    fireEvent.change(screen.getByTestId('pm-field-stock'), { target: { value: '10' } });

    fireEvent.click(screen.getByTestId('pm-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('pm-submit-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Duplicate SKU')).toBeInTheDocument();
  });

  it('disables submit button while submitting', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    mockCreateProduct.mockReturnValue(new Promise(() => {}));

    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));

    fireEvent.change(screen.getByTestId('pm-field-sku'), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByTestId('pm-field-name'), { target: { value: 'New Product' } });
    fireEvent.change(screen.getByTestId('pm-field-price'), { target: { value: '5000' } });
    fireEvent.change(screen.getByTestId('pm-field-stock'), { target: { value: '20' } });

    fireEvent.click(screen.getByTestId('pm-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('pm-submit-btn')).toBeDisabled();
    });
    expect(screen.getByText('Enregistrement…')).toBeInTheDocument();
  });

  /* Edit Modal ───────────────────────────────────────── */

  it('opens edit modal with pre-filled values', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getAllByTestId('pm-edit-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('pm-edit-btn')[0]!);

    expect(screen.getByTestId('pm-modal-title').textContent).toBe('Modifier le produit');
    expect(screen.getByTestId('pm-field-sku')).toHaveValue('RIZ-50');
    expect(screen.getByTestId('pm-field-sku')).toBeDisabled();
    expect(screen.getByTestId('pm-field-name')).toHaveValue('Riz Brisé 50 kg');
    expect(screen.getByTestId('pm-field-price')).toHaveValue(18500);
    expect(screen.getByTestId('pm-field-stock')).toHaveValue(120);
  });

  it('calls updateProduct API on edit submit', async () => {
    mockFetchMyProducts
      .mockResolvedValueOnce(PRODUCTS)
      .mockResolvedValueOnce(PRODUCTS);
    mockUpdateProduct.mockResolvedValueOnce({ id: 'p1' });

    renderManager();

    await waitFor(() => {
      expect(screen.getAllByTestId('pm-edit-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('pm-edit-btn')[0]!);
    fireEvent.change(screen.getByTestId('pm-field-stock'), { target: { value: '200' } });
    fireEvent.click(screen.getByTestId('pm-submit-btn'));

    await waitFor(() => {
      expect(mockUpdateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({
        stock_qty: 200,
      }));
    });
  });

  it('shows "Mettre à jour" label on edit submit button', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getAllByTestId('pm-edit-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('pm-edit-btn')[0]!);
    expect(screen.getByTestId('pm-submit-btn').textContent).toBe('Mettre à jour');
  });

  /* Delete Flow ──────────────────────────────────────── */

  it('shows delete confirmation on delete button click', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getAllByTestId('pm-delete-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('pm-delete-btn')[0]!);
    expect(screen.getByTestId('pm-delete-confirm')).toBeInTheDocument();
  });

  it('cancels delete confirmation', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getAllByTestId('pm-delete-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('pm-delete-btn')[0]!);
    expect(screen.getByTestId('pm-delete-confirm')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pm-delete-cancel'));
    expect(screen.queryByTestId('pm-delete-confirm')).not.toBeInTheDocument();
  });

  it('calls deleteProduct API and reloads on confirmation', async () => {
    mockFetchMyProducts
      .mockResolvedValueOnce(PRODUCTS)
      .mockResolvedValueOnce([PRODUCTS[1]!]);
    mockDeleteProduct.mockResolvedValueOnce(undefined);

    renderManager();

    await waitFor(() => {
      expect(screen.getAllByTestId('pm-delete-btn')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByTestId('pm-delete-btn')[0]!);
    fireEvent.click(screen.getByTestId('pm-delete-confirm'));

    await waitFor(() => {
      expect(mockDeleteProduct).toHaveBeenCalledWith('p1');
    });

    await waitFor(() => {
      expect(mockFetchMyProducts).toHaveBeenCalledTimes(2);
    });
  });

  /* Submit blocks on validation errors ───────────────── */

  it('does not call API when form has validation errors', async () => {
    mockFetchMyProducts.mockResolvedValueOnce(PRODUCTS);
    renderManager();

    await waitFor(() => {
      expect(screen.getByTestId('pm-add-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pm-add-btn'));

    /* Submit empty form */
    fireEvent.click(screen.getByTestId('pm-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('pm-error-sku')).toBeInTheDocument();
    });

    expect(mockCreateProduct).not.toHaveBeenCalled();
  });
});
