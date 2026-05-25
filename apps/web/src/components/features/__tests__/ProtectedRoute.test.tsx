import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProtectedRoute from '../ProtectedRoute.js';

/* ── Mock useAuth ────────────────────────────────────── */

const mockUseAuth = vi.fn();

vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => mockUseAuth(),
}));

/* ── Helpers ─────────────────────────────────────────── */

function renderProtectedRoute(
  initialRoute: string,
  allowedRoles?: string[],
) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<p data-testid="login-page">Login</p>} />
        <Route path="/" element={<p data-testid="home-page">Home</p>} />
        <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
          <Route path="/buyer" element={<p data-testid="buyer-page">Buyer</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/* ── Tests ───────────────────────────────────────────── */

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth state is resolving', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      error: null,
      isAuthenticated: false,
    });

    renderProtectedRoute('/buyer', ['buyer']);

    expect(screen.getByTestId('guard-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('buyer-page')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
    });

    renderProtectedRoute('/buyer', ['buyer']);

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('buyer-page')).not.toBeInTheDocument();
  });

  it('renders child route when authenticated with correct role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u-1', role: 'buyer', email: 'k@t.ci', organization_id: null, first_name: 'K', last_name: 'Y', phone: null },
      loading: false,
      error: null,
      isAuthenticated: true,
    });

    renderProtectedRoute('/buyer', ['buyer']);

    expect(screen.getByTestId('buyer-page')).toBeInTheDocument();
  });

  it('redirects to / when authenticated but wrong role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u-1', role: 'delivery', email: 'k@t.ci', organization_id: null, first_name: 'K', last_name: 'Y', phone: null },
      loading: false,
      error: null,
      isAuthenticated: true,
    });

    renderProtectedRoute('/buyer', ['buyer']);

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('buyer-page')).not.toBeInTheDocument();
  });

  it('renders child route when no allowedRoles specified (any authenticated)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u-1', role: 'wholesaler', email: 'w@t.ci', organization_id: 'org-1', first_name: 'W', last_name: 'G', phone: null },
      loading: false,
      error: null,
      isAuthenticated: true,
    });

    renderProtectedRoute('/buyer');

    expect(screen.getByTestId('buyer-page')).toBeInTheDocument();
  });
});
