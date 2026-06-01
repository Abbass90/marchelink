import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import '../primitives/catalog.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Garde-fou global de rendu. Capture toute exception non gérée dans l'arbre
 * React et affiche un fallback lisible au lieu d'un écran blanc. Doit être une
 * classe (getDerivedStateFromError + componentDidCatch). Réutilise les classes
 * du design system (§32) — aucun CSS neuf.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Garde-fou racine : on trace pour le debug navigateur (pas de logger
    // structuré côté front). console.error (et non console.log) est volontaire.
    console.error('ErrorBoundary a capturé une erreur de rendu', error, info);
  }

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="catalog-page" data-testid="error-boundary">
          <div className="catalog-container">
            <div className="catalog-error">
              <div className="catalog-empty-icon" aria-hidden="true">&#9888;</div>
              <p className="catalog-error-text">Une erreur inattendue est survenue.</p>
              <button type="button" className="catalog-retry-btn" onClick={this.handleReload}>
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
