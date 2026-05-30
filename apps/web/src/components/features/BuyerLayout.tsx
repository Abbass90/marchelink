import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useCart } from '../../context/CartContext.js';
import { useChatUnread } from '../../hooks/useChatUnread.js';
import { useState, useCallback } from 'react';
import AssistantWidget from './AssistantWidget.js';
import '../primitives/layout.css';

export default function BuyerLayout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const chatUnread = useChatUnread();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeSidebar = useCallback(() => setDrawerOpen(false), []);

  const initials =
    (user?.first_name?.[0] ?? '') + (user?.last_name?.[0] ?? '');

  return (
    <div className="layout">

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

      {/* ── Sidebar ── */}
      <aside
        className={`layout-sidebar ${drawerOpen ? 'layout-sidebar--open' : ''}`}
        data-testid="layout-sidebar"
      >
        {/* Brand */}
        <div className="layout-brand">
          <div className="layout-brand-name">MarchéLink</div>
          <div className="layout-brand-role">Espace Acheteur</div>
        </div>

        {/* Nav */}
        <nav className="layout-nav">
          <NavLink
            to="/buyer/catalog"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-catalog"
          >
            <span className="layout-nav-icon">🛍️</span>
            <span className="layout-nav-label">Catalogue</span>
          </NavLink>

          <NavLink
            to="/buyer/orders"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-orders"
          >
            <span className="layout-nav-icon">📋</span>
            <span className="layout-nav-label">Mes Commandes</span>
          </NavLink>

          <NavLink
            to="/buyer/payments"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-payments"
          >
            <span className="layout-nav-icon">💳</span>
            <span className="layout-nav-label">Paiements</span>
          </NavLink>

          <NavLink
            to="/buyer/chat"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-chat"
          >
            <span className="layout-nav-icon">💬</span>
            <span className="layout-nav-label">Messages</span>
            {chatUnread > 0 && (
              <span className="layout-nav-badge" data-testid="nav-chat-badge">
                {chatUnread}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/buyer/cart"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-cart"
          >
            <span className="layout-nav-icon">🛒</span>
            <span className="layout-nav-label">Mon Panier</span>
            {itemCount > 0 && (
              <span className="layout-nav-badge" data-testid="nav-cart-badge">
                {itemCount}
              </span>
            )}
          </NavLink>

          <div className="layout-nav-divider" />

          <NavLink
            to="/buyer/settings"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-settings"
          >
            <span className="layout-nav-icon">⚙️</span>
            <span className="layout-nav-label">Paramètres</span>
          </NavLink>
        </nav>

        {/* Profile */}
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

      {/* ── Main content ── */}
      <main className="layout-main">
        <Outlet />
      </main>

      {/* ── Assistant IA flottant ── */}
      <AssistantWidget />
    </div>
  );
}
