import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authVerifyEmail, ApiError } from '../api/client.js';
import '../components/primitives/auth.css';

type Status = 'loading' | 'success' | 'error';

/**
 * Page de confirmation d'email — cible du lien envoyé par email.
 * Lit le token dans l'URL (?token=...), appelle l'API, puis affiche
 * les trois états (§30) : Loading / Success / Error (avec Retry).
 */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('');

  const verify = useCallback(async () => {
    if (!token) {
      setStatus('error');
      setMessage('Lien de vérification invalide — le token est manquant.');
      return;
    }
    setStatus('loading');
    try {
      const res = await authVerifyEmail(token);
      setStatus('success');
      setMessage(res.message);
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof ApiError
          ? err.message
          : 'Une erreur est survenue lors de la vérification. Réessayez.',
      );
    }
  }, [token]);

  useEffect(() => {
    void verify();
  }, [verify]);

  return (
    <div className="auth-page" data-testid="verify-email-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-dot" />
            MarchéLink
          </Link>
          <h1 className="auth-title">Vérification de l'email</h1>
        </div>

        {/* ── Loading ─────────────────────────────────────── */}
        {status === 'loading' && (
          <p className="auth-subtitle" data-testid="verify-loading">
            <span className="auth-spinner" aria-hidden="true" /> Vérification en cours…
          </p>
        )}

        {/* ── Success ─────────────────────────────────────── */}
        {status === 'success' && (
          <>
            <p className="auth-subtitle" data-testid="verify-success">
              {message}
            </p>
            <div className="auth-form-actions">
              <Link to="/login" className="auth-submit">
                Se connecter
              </Link>
            </div>
          </>
        )}

        {/* ── Error ───────────────────────────────────────── */}
        {status === 'error' && (
          <>
            <div className="auth-error-banner" role="alert" data-testid="verify-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
              </svg>
              <span>{message}</span>
            </div>
            <div className="auth-form-actions">
              <button type="button" className="auth-submit" onClick={() => void verify()}>
                Réessayer
              </button>
            </div>
            <p className="auth-footer">
              Le lien a expiré ?{' '}
              <Link to="/register">Recommencer l'inscription</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
