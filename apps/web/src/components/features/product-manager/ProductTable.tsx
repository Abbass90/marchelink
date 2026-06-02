import { useState } from 'react';
import { X } from 'lucide-react';
import type { Product } from '../../../api/client.js';
import { formatXOF } from './product-form.helpers.js';

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => Promise<void>;
}

export default function ProductTable({ products, onEdit, onDelete }: ProductTableProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function confirmDelete(id: string) {
    setDeletingId(id);
    try {
      await onDelete(id);
      setDeleteConfirm(null);
    } catch {
      /* soft fail for delete */
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="pm-table-wrap" data-testid="pm-product-list">
      <table className="pm-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Produit</th>
            <th>Prix (XOF)</th>
            <th>Stock</th>
            <th>Unité</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} data-testid="pm-product-row">
              <td className="pm-cell-sku">{p.sku}</td>
              <td className="pm-cell-name">{p.name}</td>
              <td className="pm-cell-price">{formatXOF(p.price_xof)}</td>
              <td>
                <span
                  className={`ws-stock-badge ${
                    p.stock_qty === 0
                      ? 'ws-stock-badge--zero'
                      : p.stock_qty <= 10
                        ? 'ws-stock-badge--low'
                        : 'ws-stock-badge--ok'
                  }`}
                  data-testid="pm-stock-badge"
                >
                  {p.stock_qty}
                </span>
              </td>
              <td className="pm-cell-unit">{p.unit}</td>
              <td className="pm-cell-actions">
                <button
                  className="ws-btn ws-btn--sm ws-btn--ghost"
                  data-testid="pm-edit-btn"
                  onClick={() => onEdit(p)}
                >
                  Modifier
                </button>
                {deleteConfirm === p.id ? (
                  <span className="pm-delete-confirm">
                    <button
                      className="ws-btn ws-btn--sm ws-btn--danger"
                      data-testid="pm-delete-confirm"
                      disabled={deletingId === p.id}
                      onClick={() => void confirmDelete(p.id)}
                    >
                      {deletingId === p.id ? '…' : 'Confirmer'}
                    </button>
                    <button
                      className="ws-btn ws-btn--sm ws-btn--secondary"
                      data-testid="pm-delete-cancel"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ) : (
                  <button
                    className="ws-btn ws-btn--sm ws-btn--ghost ws-btn--danger-text"
                    data-testid="pm-delete-btn"
                    onClick={() => setDeleteConfirm(p.id)}
                  >
                    Supprimer
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
