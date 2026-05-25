import { useState, useCallback, useEffect } from 'react';
import type { FormEvent, FocusEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../api/client.js';
import '../components/primitives/auth.css';

/* ── Schéma de validation ────────────────────────────────────── */

const LoginFormSchema = z.object({
  email:    z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof LoginFormSchema>, string>>;

/* ── Redirection selon rôle ──────────────────────────────────── */

function dashboardPath(role: string): string {
  if (role === 'buyer')                                        return '/buyer';
  if (role === 'wholesaler_admin' || role === 'wholesaler_seller') return '/wholesaler';
  if (role === 'delivery_operator')                            return '/delivery';
  if (role === 'platform_admin')                               return '/admin';
  return '/';
}

/* ── Composant ───────────────────────────────────────────────── */

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  /* Déjà connecté → redirection immédiate */
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(dashboardPath(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  /* Validation au blur */
  const validateField = useCallback(
    (field: keyof z.infer<typeof LoginFormSchema>, value: string) => {
      const result = LoginFormSchema.shape[field].safeParse(value);
      setFieldErrors((prev) => ({
        ...prev,
        [field]: result.success ? undefined : result.error.errors[0]?.message,
      }));
    },
    [],
  );

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      validateField(name as keyof z.infer<typeof LoginFormSchema>, value);
    },
    [validateField],
  );

  /* Soumission */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setApiError(null);

      const parsed = LoginFormSchema.safeParse({ email, password });
      if (!parsed.success) {
        const errs: FieldErrors = {};
        for (const issue of parsed.error.errors) {
          const key = issue.path[0] as keyof FieldErrors;
          if (!errs[key]) errs[key] = issue.message;
        }
        setFieldErrors(errs);
        return;
      }

      setSubmitting(true);
      try {
        await login(parsed.data);
        // useAuth met à jour user → useEffect ci-dessus déclenche la redirection
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez.';
        setApiError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, login],
  );

  return (
    <div className="auth-page" data-testid="login-page">
      <div className="auth-card">

        {/* En-tête */}
        <div className="auth-header">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-dot" />
            MarchéLink
          </Link>
          <h1 className="auth-title">Connexion</h1>
          <p className="auth-subtitle">
            Accédez à votre espace sur la plateforme
          </p>
        </div>

        {/* Bannière d'erreur API */}
        {apiError && (
          <div className="auth-error-banner" role="alert" data-testid="api-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        {/* Formulaire */}
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)} noValidate>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              className={`auth-input${fieldErrors.email ? ' auth-input--error' : ''}`}
              placeholder="kouadio@example.ci"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleBlur}
              autoComplete="email"
              disabled={submitting}
              data-testid="email-input"
            />
            <span className="auth-field-error" data-testid="error-email">
              {fieldErrors.email ?? ''}
            </span>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">Mot de passe</label>
            <input
              id="login-password"
              name="password"
              type="password"
              className={`auth-input${fieldErrors.password ? ' auth-input--error' : ''}`}
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={handleBlur}
              autoComplete="current-password"
              disabled={submitting}
              data-testid="password-input"
            />
            <span className="auth-field-error" data-testid="error-password">
              {fieldErrors.password ?? ''}
            </span>
          </div>

          {/* Zone bouton — espace supplémentaire au-dessus */}
          <div className="auth-form-actions">
            <button
              type="submit"
              className="auth-submit"
              disabled={submitting}
              data-testid="submit-btn"
            >
              {submitting && <span className="auth-spinner" aria-hidden="true" />}
              {submitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </div>
        </form>

        {/* Lien inscription */}
        <p className="auth-footer">
          Pas encore de compte ?{' '}
          <Link to="/register">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
