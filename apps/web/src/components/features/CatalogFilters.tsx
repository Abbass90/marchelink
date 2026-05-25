import type { BrowseParams } from '../../api/client.js';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  sort: NonNullable<BrowseParams['sort']>;
  onSortChange: (v: BrowseParams['sort']) => void;
  minPrice: string;
  onMinPriceChange: (v: string) => void;
  maxPrice: string;
  onMaxPriceChange: (v: string) => void;
  inStock: boolean;
  onInStockChange: (v: boolean) => void;
}

export default function CatalogFilters({
  search, onSearchChange,
  sort, onSortChange,
  minPrice, onMinPriceChange,
  maxPrice, onMaxPriceChange,
  inStock, onInStockChange,
}: Props) {
  return (
    <div className="cf-wrap" data-testid="catalog-filters">
      {/* Search */}
      <div className="catalog-search-wrap">
        <svg className="catalog-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z" />
        </svg>
        <input
          type="text"
          className="catalog-search"
          placeholder="Rechercher un produit ou SKU…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          data-testid="catalog-search"
        />
      </div>

      {/* Price + sort row */}
      <div className="cf-row">
        <span className="cf-label">Prix (F)</span>
        <div className="cf-price-group">
          <input
            type="number"
            className="cf-price-input"
            placeholder="Min"
            value={minPrice}
            min={0}
            onChange={(e) => onMinPriceChange(e.target.value)}
            data-testid="catalog-min-price"
          />
          <span className="cf-price-sep">—</span>
          <input
            type="number"
            className="cf-price-input"
            placeholder="Max"
            value={maxPrice}
            min={0}
            onChange={(e) => onMaxPriceChange(e.target.value)}
            data-testid="catalog-max-price"
          />
        </div>

        <select
          className="cf-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as BrowseParams['sort'])}
          data-testid="catalog-sort"
        >
          <option value="newest">Plus récents</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
          <option value="name">Nom A→Z</option>
        </select>
      </div>

      {/* In stock toggle */}
      <label className="cf-toggle-row">
        <input
          type="checkbox"
          className="cf-toggle-input"
          checked={inStock}
          onChange={(e) => onInStockChange(e.target.checked)}
          data-testid="catalog-in-stock"
        />
        <span className="cf-toggle-label">En stock uniquement</span>
      </label>
    </div>
  );
}
