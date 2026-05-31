import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts, ApiError } from '../api/client.js';
import type { BrowseProduct, PaginatedProducts, BrowseParams } from '../api/client.js';
import CatalogFilters from '../components/features/CatalogFilters.js';
import { categoryLabel } from '../constants/categories.js';
import '../components/primitives/catalog.css';

const PAGE_SIZE = 12;

function formatXOF(amount: string): string {
  return Number(amount).toLocaleString('fr-FR') + ' F';
}

export default function BuyerCatalog() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<NonNullable<BrowseParams['sort']>>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Debounce search → reset page */
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  /* Fetch on any filter or page change */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProducts({
      q: debouncedSearch || undefined,
      category: category || undefined,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
      in_stock: inStock || undefined,
      sort,
      page,
      limit: PAGE_SIZE,
    }).then((res) => {
      if (!cancelled) setData(res);
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof ApiError ? err.message : 'Impossible de charger les produits');
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, category, minPrice, maxPrice, inStock, sort, page]);

  const handleCategory = (v: string) => { setCategory(v); setPage(1); };
  const handleSort = (v: BrowseParams['sort']) => { setSort(v ?? 'newest'); setPage(1); };
  const handleInStock = (v: boolean) => { setInStock(v); setPage(1); };
  const handleMinPrice = (v: string) => { setMinPrice(v); setPage(1); };
  const handleMaxPrice = (v: string) => { setMaxPrice(v); setPage(1); };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const products: BrowseProduct[] = data?.data ?? [];

  if (loading && !data) {
    return (
      <div className="catalog-page" data-testid="catalog-page">
        <div className="catalog-container">
          <div className="catalog-header"><h1 className="catalog-title">Catalogue</h1></div>
          <div className="catalog-grid" data-testid="catalog-loading">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="catalog-skeleton catalog-skeleton-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="catalog-page" data-testid="catalog-page">
        <div className="catalog-container">
          <div className="catalog-error" data-testid="catalog-error">
            <p className="catalog-error-text">{error}</p>
            <button className="catalog-retry-btn" onClick={() => setPage((p) => p)}>
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-page" data-testid="catalog-page">
      <div className="catalog-container">
        <div className="catalog-header">
          <h1 className="catalog-title">Catalogue</h1>
          <p className="catalog-subtitle">Parcourez les produits de tous les grossistes</p>
        </div>

        <CatalogFilters
          search={search} onSearchChange={setSearch}
          category={category} onCategoryChange={handleCategory}
          sort={sort} onSortChange={handleSort}
          minPrice={minPrice} onMinPriceChange={handleMinPrice}
          maxPrice={maxPrice} onMaxPriceChange={handleMaxPrice}
          inStock={inStock} onInStockChange={handleInStock}
        />

        <p className="catalog-count" data-testid="catalog-count">
          {data?.total ?? 0} produit{(data?.total ?? 0) !== 1 ? 's' : ''} trouvé{(data?.total ?? 0) !== 1 ? 's' : ''}
        </p>

        <div className="catalog-grid" data-testid="catalog-grid">
          {products.length === 0 ? (
            <div className="catalog-empty" data-testid="catalog-empty">
              <div className="catalog-empty-icon">&#128270;</div>
              <p className="catalog-empty-text">Aucun produit trouvé</p>
            </div>
          ) : (
            products.map((product) => (
              <Link key={product.id} to={`/buyer/products/${product.id}`}
                className="catalog-card" data-testid="catalog-card"
              >
                {product.image_url ? (
                  <img className="catalog-card-img" src={product.image_url} alt={product.name} />
                ) : (
                  <div className="catalog-card-img-placeholder" aria-hidden="true">&#128722;</div>
                )}
                <div className="catalog-card-body">
                  <p className="catalog-card-name">{product.name}</p>
                  <p className="catalog-card-org">{product.org_name} · {categoryLabel(product.category)}</p>
                  <div className="catalog-card-footer">
                    <span className="catalog-card-price">
                      {formatXOF(product.price_xof)}
                      <span className="catalog-card-unit"> / {product.unit}</span>
                    </span>
                    {product.stock_qty > 0 ? (
                      <span className="catalog-badge catalog-badge--in-stock" data-testid="badge-in-stock">
                        <span className="catalog-badge-dot" />En stock
                      </span>
                    ) : (
                      <span className="catalog-badge catalog-badge--out" data-testid="badge-out">
                        <span className="catalog-badge-dot" />Rupture
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {(data?.total ?? 0) > PAGE_SIZE && (
          <div className="catalog-pagination" data-testid="catalog-pagination">
            <button className="catalog-pag-btn" data-testid="catalog-prev"
              onClick={() => setPage((p) => p - 1)} disabled={page === 1}
            >
              ← Précédent
            </button>
            <span className="catalog-pag-info">Page {page} / {totalPages}</span>
            <button className="catalog-pag-btn" data-testid="catalog-next"
              onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
