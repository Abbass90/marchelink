import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import OrderConfirmation from '../OrderConfirmation.js';

/* ── Helper ──────────────────────────────────────────── */

function renderConfirmation(
  id: string,
  state?: { orderId?: string; totalXof?: string },
) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: `/buyer/order-confirmation/${id}`,
          state: state ?? undefined,
        },
      ]}
    >
      <Routes>
        <Route
          path="/buyer/order-confirmation/:id"
          element={<OrderConfirmation />}
        />
        <Route
          path="/buyer/catalog"
          element={<p data-testid="catalog-page">Catalog</p>}
        />
        <Route
          path="/buyer"
          element={<p data-testid="dashboard-page">Dashboard</p>}
        />
        <Route
          path="/buyer/pay/:orderId"
          element={<p data-testid="payment-page">Payment</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

/* ── Tests ───────────────────────────────────────────── */

describe('OrderConfirmation — UC-12', () => {
  it('renders confirmation page', () => {
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    expect(screen.getByTestId('confirmation-page')).toBeInTheDocument();
    expect(screen.getByTestId('confirmation-card')).toBeInTheDocument();
  });

  it('displays success title', () => {
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    expect(screen.getByTestId('confirmation-title').textContent).toContain(
      'Commande enregistrée',
    );
  });

  it('displays truncated order ID', () => {
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    expect(screen.getByTestId('confirmation-order-id').textContent).toBe(
      'ABCD1234',
    );
  });

  it('displays total formatted in XOF', () => {
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    expect(screen.getByTestId('confirmation-total').textContent).toMatch(
      /42.500 F/,
    );
  });

  it('renders link to catalog', () => {
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    expect(screen.getByTestId('confirmation-catalog-link')).toHaveAttribute(
      'href',
      '/buyer/catalog',
    );
  });

  it('renders link to payment flow', () => {
    renderConfirmation('abcd1234-5678-9012-3456', {
      orderId: 'abcd1234-5678-9012-3456',
      totalXof: '42500',
    });

    expect(screen.getByTestId('confirmation-pay-link')).toHaveAttribute(
      'href',
      '/buyer/pay/abcd1234-5678-9012-3456',
    );
  });

  it('falls back gracefully without location state', () => {
    renderConfirmation('fallback1-0000-0000-0000');

    expect(screen.getByTestId('confirmation-order-id').textContent).toBe(
      'FALLBACK',
    );
    // No total shown without state
    expect(screen.queryByTestId('confirmation-total')).not.toBeInTheDocument();
  });
});
