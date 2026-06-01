import { Link } from 'react-router-dom';
import '../components/primitives/catalog.css';

/**
 * Route catch-all (404). Rendue hors layout : elle pose donc son propre fond
 * pleine hauteur. Réutilise les classes du design system (§32) — aucun CSS neuf.
 */
export default function NotFound() {
  return (
    <div className="catalog-page" data-testid="notfound-page">
      <div className="catalog-container">
        <div className="catalog-error">
          <div className="catalog-empty-icon" aria-hidden="true">404</div>
          <p className="catalog-empty-text">Page introuvable</p>
          <Link to="/" className="catalog-retry-btn" data-testid="notfound-home-link">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
