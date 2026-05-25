import { NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useState, useCallback } from 'react';
import '../primitives/layout.css';

export default function DeliveryLayout() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchParams] = useSearchParams();

  const closeSidebar = useCallback(() => setDrawerOpen(false), []);

  const initials =
    (user?.first_name?.[0] ?? '') + (user?.last_name?.[0] ?? '');

  const currentView = searchParams.get('view') ?? 'available';

  return (
    <div className="layout layout--delivery">

      {/* ── Mobile header ── */}
      <header className="layout-mobile-header">
        <span className="layout-mobile-brand">MarchéLink</span>
        <button
          className={`layout-hamburger ${drawerOpen ? 'layout-hamburger--open' : ''}`}
          onClick={() => setDrawerOpen((o) => !o)}
          aria-label="Menu"
          data-testid="layout-hamburger"
        >
          <span className="layout-hamburger-line" />
          <span className="layout-hamburger-line" />
          <span className="layout-hamburger-line" />
        </button>
      </header>

      {/* ── Overlay ── */}
      <div
        className={`layout-overlay ${drawerOpen ? 'layout-overlay--open layout-overlay--visible' : ''}`}
        onClick={closeSidebar}
      />

      {/* ── Sidebar (desktop/tablet) ── */}
      <aside
        className={`layout-sidebar ${drawerOpen ? 'layout-sidebar--open' : ''}`}
        data-testid="layout-sidebar"
      >
        <div className="layout-brand">
          <div className="layout-brand-name">MarchéLink</div>
          <div className="layout-brand-role">Espace Livreur</div>
        </div>

        <nav className="layout-nav">
          <NavLink
            to="/delivery?view=available"
            className={`layout-nav-link ${currentView === 'available' ? 'layout-nav-link--active' : ''}`}
            onClick={closeSidebar}
            data-testid="nav-available"
          >
            <span className="layout-nav-icon">📦</span>
            <span className="layout-nav-label">Livraisons Disponibles</span>
          </NavLink>

          <NavLink
            to="/delivery?view=mine"
            className={`layout-nav-link ${currentView === 'mine' ? 'layout-nav-link--active' : ''}`}
            onClick={closeSidebar}
            data-testid="nav-mine"
          >
            <span className="layout-nav-icon">🛵</span>
            <span className="layout-nav-label">Mes Courses</span>
          </NavLink>
        </nav>

        <div className="layout-profile">
          <div className="layout-profile-row">
            <div className="layout-profile-avatar">{initials}</div>
            <div className="layout-profile-info">
              <div className="layout-profile-name" data-testid="layout-user-name">
                {user?.first_name} {user?.last_name}
              </div>
              <div className="layout-profile-email">{user?.email}</div>
            </div>
          </div>
          <button
            className="layout-logout"
            onClick={() => void logout()}
            data-testid="layout-logout"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="del-bottom-nav" data-testid="del-bottom-nav">
        <NavLink
          to="/delivery?view=available"
          className={`del-bottom-link ${currentView === 'available' ? 'del-bottom-link--active' : ''}`}
          data-testid="bottom-nav-available"
        >
          <span className="del-bottom-link-icon">📦</span>
          <span className="del-bottom-link-label">Disponibles</span>
        </NavLink>

        <NavLink
          to="/delivery?view=mine"
          className={`del-bottom-link ${currentView === 'mine' ? 'del-bottom-link--active' : ''}`}
          data-testid="bottom-nav-mine"
        >
          <span className="del-bottom-link-icon">🛵</span>
          <span className="del-bottom-link-label">Mes Courses</span>
        </NavLink>
      </nav>

      {/* ── Main content ── */}
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
