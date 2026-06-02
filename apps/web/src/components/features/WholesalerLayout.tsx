import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart2, Package, FileText, CreditCard, MessageSquare, Settings2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useChatUnread } from '../../hooks/useChatUnread.js';
import { useState, useCallback } from 'react';
import '../primitives/layout.css';

export default function WholesalerLayout() {
  const { user, logout } = useAuth();
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
          <div className="layout-brand-role">Espace Grossiste</div>
        </div>

        {/* Nav */}
        <nav className="layout-nav">
          <NavLink
            to="/wholesaler"
            end
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-dashboard"
          >
            <span className="layout-nav-icon"><BarChart2 size={18} /></span>
            <span className="layout-nav-label">Tableau de bord</span>
          </NavLink>

          <NavLink
            to="/wholesaler/products"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-products"
          >
            <span className="layout-nav-icon"><Package size={18} /></span>
            <span className="layout-nav-label">Gestion Catalogue</span>
          </NavLink>

          <NavLink
            to="/wholesaler/orders"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-orders"
          >
            <span className="layout-nav-icon"><FileText size={18} /></span>
            <span className="layout-nav-label">Commandes Reçues</span>
          </NavLink>

          <NavLink
            to="/wholesaler/payments"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-payments"
          >
            <span className="layout-nav-icon"><CreditCard size={18} /></span>
            <span className="layout-nav-label">Paiements</span>
          </NavLink>

          <NavLink
            to="/wholesaler/chat"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-chat"
          >
            <span className="layout-nav-icon"><MessageSquare size={18} /></span>
            <span className="layout-nav-label">Messages</span>
            {chatUnread > 0 && (
              <span className="layout-nav-badge" data-testid="nav-chat-badge">
                {chatUnread}
              </span>
            )}
          </NavLink>

          <div className="layout-nav-divider" />

          <NavLink
            to="/wholesaler/settings"
            className={({ isActive }) =>
              `layout-nav-link ${isActive ? 'layout-nav-link--active' : ''}`
            }
            onClick={closeSidebar}
            data-testid="nav-settings"
          >
            <span className="layout-nav-icon"><Settings2 size={18} /></span>
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
    </div>
  );
}
