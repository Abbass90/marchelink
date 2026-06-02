import { useState, useCallback } from 'react';
import type { FormEvent, FocusEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../api/client.js';
import '../components/primitives/auth.css';

/** Validation format numéro ivoirien — normalisation côté backend. */
const ciPhoneSchema = z
  .string()
  .min(1, 'Le numéro est requis')
  .refine((val) => {
    const s = val.replace(/[\s\-\.\(\)]/g, '');
    return /^(\+225|00225)?\d{10}$/.test(s);
  }, 'Numéro ivoirien invalide — ex : 07 00 00 00 00 ou +225 07 00 00 00 00');

const RegisterWholesalerFormSchema = z.object({
  organization_name: z.string().min(1, "Le nom de l'entreprise est requis").max(255),
  first_name: z.string().min(1, 'Le prénom est requis').max(100),
  last_name: z.string().min(1, 'Le nom est requis').max(100),
  email: z.string().email('Adresse email invalide').max(320),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .max(128),
  phone: ciPhoneSchema,
});

type FormFields = z.infer<typeof RegisterWholesalerFormSchema>;
type FieldErrors = Partial<Record<keyof FormFields, string>>;

function dashboardPath(role: string): string {
  switch (role) {
    case 'wholesaler_admin':
    case 'wholesaler_seller':
      return '/wholesaler';
    case 'buyer':
      return '/buyer';
    default:
      return '/';
  }
}

export default function RegisterWholesaler() {
  const { registerWholesaler, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [fields, setFields] = useState<FormFields>({
    organization_name: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && user) {
    navigate(dashboardPath(user.role), { replace: true });
    return null;
  }

  const updateField = useCallback((name: keyof FormFields, value: string) => {
    setFields((prev: FormFields) => ({ ...prev, [name]: value }));
  }, []);

  const validateField = useCallback(
    (field: keyof FormFields, value: string) => {
      const schema = RegisterWholesalerFormSchema.shape[field];
      const result = schema.safeParse(value);
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
      validateField(name as keyof FormFields, value);
    },
    [validateField],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setApiError(null);

      const parsed = RegisterWholesalerFormSchema.safeParse(fields);
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
        await registerWholesaler(parsed.data);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez.';
        setApiError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [fields, registerWholesaler],
  );

  return (
    <div className="auth-page" data-testid="register-wholesaler-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-dot" />
            MarchéLink
          </Link>
          <h1 className="auth-title">Inscription Grossiste</h1>
          <p className="auth-subtitle">
            Créez votre espace grossiste et commencez à vendre
          </p>
        </div>

        {apiError && (
          <div className="auth-error-banner" role="alert" data-testid="api-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-org-name">Nom de l&apos;entreprise</label>
            <input
              id="reg-org-name"
              name="organization_name"
              type="text"
              className={`auth-input${fieldErrors.organization_name ? ' auth-input--error' : ''}`}
              placeholder="Ex : Tissus d'Aya"
              value={fields.organization_name}
              onChange={(e) => updateField('organization_name', e.target.value)}
              onBlur={handleBlur}
              autoComplete="organization"
              disabled={submitting}
            />
            <span className="auth-field-error" data-testid="error-organization_name">
              {fieldErrors.organization_name ?? ''}
            </span>
          </div>

          <div className="auth-row">
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-first-name">Prénom</label>
              <input
                id="reg-first-name"
                name="first_name"
                type="text"
                className={`auth-input${fieldErrors.first_name ? ' auth-input--error' : ''}`}
                placeholder="Aya"
                value={fields.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                onBlur={handleBlur}
                autoComplete="given-name"
                disabled={submitting}
              />
              <span className="auth-field-error" data-testid="error-first_name">
                {fieldErrors.first_name ?? ''}
              </span>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-last-name">Nom</label>
              <input
                id="reg-last-name"
                name="last_name"
                type="text"
                className={`auth-input${fieldErrors.last_name ? ' auth-input--error' : ''}`}
                placeholder="Koné"
                value={fields.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
                onBlur={handleBlur}
                autoComplete="family-name"
                disabled={submitting}
              />
              <span className="auth-field-error" data-testid="error-last_name">
                {fieldErrors.last_name ?? ''}
              </span>
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              name="email"
              type="email"
              className={`auth-input${fieldErrors.email ? ' auth-input--error' : ''}`}
              placeholder="aya@tissus.ci"
              value={fields.email}
              onChange={(e) => updateField('email', e.target.value)}
              onBlur={handleBlur}
              autoComplete="email"
              disabled={submitting}
            />
            <span className="auth-field-error" data-testid="error-email">
              {fieldErrors.email ?? ''}
            </span>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-password">Mot de passe</label>
            <input
              id="reg-password"
              name="password"
              type="password"
              className={`auth-input${fieldErrors.password ? ' auth-input--error' : ''}`}
              placeholder="Minimum 8 caractères"
              value={fields.password}
              onChange={(e) => updateField('password', e.target.value)}
              onBlur={handleBlur}
              autoComplete="new-password"
              disabled={submitting}
            />
            <span className="auth-field-error" data-testid="error-password">
              {fieldErrors.password ?? ''}
            </span>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-phone">
              Téléphone
            </label>
            <input
              id="reg-phone"
              name="phone"
              type="tel"
              className={`auth-input${fieldErrors.phone ? ' auth-input--error' : ''}`}
              placeholder="+225 07 01 00 00 01"
              value={fields.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              onBlur={handleBlur}
              autoComplete="tel"
              disabled={submitting}
            />
            <span className="auth-field-error" data-testid="error-phone">
              {fieldErrors.phone ?? ''}
            </span>
          </div>

          <div className="auth-form-actions">
            <button
              type="submit"
              className="auth-submit"
              disabled={submitting}
              data-testid="submit-btn"
            >
              {submitting && <span className="auth-spinner" aria-hidden="true" />}
              {submitting ? 'Inscription…' : 'Créer mon espace grossiste'}
            </button>
          </div>
        </form>

        <p className="auth-footer">
          Vous êtes boutiquier ?{' '}
          <Link to="/register">Inscription boutiquier</Link>
        </p>
        <p className="auth-footer">
          Déjà un compte ?{' '}
          <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
