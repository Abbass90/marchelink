import { useState, useCallback } from 'react';
import type { FormEvent, FocusEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../api/client.js';
import CameraCapture from '../components/features/CameraCapture.js';
import '../components/primitives/auth.css';

/* ── Zod Schema (mirrors backend RegisterBuyerSchema) ── */

/** Validation format numéro ivoirien — normalisation côté backend. */
const ciPhoneSchema = z
  .string()
  .min(1, 'Le numéro est requis')
  .refine((val) => {
    const s = val.replace(/[\s\-\.\(\)]/g, '');
    return /^(\+225|00225)?\d{10}$/.test(s);
  }, 'Numéro ivoirien invalide — ex : 07 00 00 00 00 ou +225 07 00 00 00 00');

const RegisterFormSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est requis').max(100),
  last_name: z.string().min(1, 'Le nom est requis').max(100),
  email: z.string().email('Adresse email invalide').max(320),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .max(128),
  phone: ciPhoneSchema,
});

type FormFields = z.infer<typeof RegisterFormSchema>;
type FieldErrors = Partial<Record<keyof FormFields, string>>;

/* ── Role → dashboard mapping ────────────────────────── */

function dashboardPath(role: string): string {
  switch (role) {
    case 'buyer':
      return '/buyer';
    case 'wholesaler':
      return '/wholesaler';
    default:
      return '/';
  }
}

/* ── Component ───────────────────────────────────────── */

export default function Register() {
  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [fields, setFields] = useState<FormFields>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  /* ── Already authenticated → redirect ──────────────── */
  if (isAuthenticated && user) {
    navigate(dashboardPath(user.role), { replace: true });
    return null;
  }

  /* ── Generic field setter ──────────────────────────── */
  const updateField = useCallback((name: keyof FormFields, value: string) => {
    setFields((prev: FormFields) => ({ ...prev, [name]: value }));
  }, []);

  /* ── Validate single field on blur ─────────────────── */
  const validateField = useCallback(
    (field: keyof FormFields, value: string) => {
      const schema = RegisterFormSchema.shape[field];
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

  /* ── Submit ────────────────────────────────────────── */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setApiError(null);

      const parsed = RegisterFormSchema.safeParse(fields);
      if (!parsed.success) {
        const errs: FieldErrors = {};
        for (const issue of parsed.error.errors) {
          const key = issue.path[0] as keyof FieldErrors;
          if (!errs[key]) errs[key] = issue.message;
        }
        setFieldErrors(errs);
        return;
      }

      /* Photo obligatoire — §8 */
      if (!profilePhoto) {
        setPhotoError('La photo de profil est requise');
        return;
      }
      setPhotoError(null);

      setSubmitting(true);
      try {
        await register({ ...parsed.data, profile_photo: profilePhoto });
        // Registration succeeded — user must verify email before logging in.
        setEmailSent(true);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez.';
        setApiError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [fields, profilePhoto, register],
  );

  /* ── Succès : email de vérification envoyé ─────────────── */
  if (emailSent) {
    return (
      <div className="auth-page" data-testid="register-page">
        <div className="auth-card">
          <div className="auth-header">
            <Link to="/" className="auth-brand">
              <span className="auth-brand-dot" />
              MarchéLink
            </Link>
            <h1 className="auth-title">Vérifiez votre email</h1>
            <p className="auth-subtitle">
              Votre compte a été créé avec succès !
            </p>
          </div>
          <p className="auth-subtitle">
            Un email de confirmation a été envoyé à <strong>{fields.email}</strong>.
            Cliquez sur le lien pour activer votre compte, puis connectez-vous.
          </p>
          <div className="auth-form-actions">
            <Link to="/login" className="auth-submit">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" data-testid="register-page">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-dot" />
            MarchéLink
          </Link>
          <h1 className="auth-title">Créer un compte</h1>
          <p className="auth-subtitle">
            Rejoignez la plateforme des grossistes d'Adjamé
          </p>
        </div>

        {/* API Error Banner */}
        {apiError && (
          <div className="auth-error-banner" role="alert" data-testid="api-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {/* Name row */}
          <div className="auth-row">
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-first-name">Prénom</label>
              <input
                id="reg-first-name"
                name="first_name"
                type="text"
                className={`auth-input${fieldErrors.first_name ? ' auth-input--error' : ''}`}
                placeholder="Kouadio"
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
                placeholder="Yao"
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
              placeholder="kouadio@example.ci"
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
              placeholder="+225 07 00 00 00 00"
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

          {/* §8 — Photo de profil obligatoire (caméra uniquement) */}
          <div className="auth-field">
            <label className="auth-label">Photo de profil</label>
            <CameraCapture
              onCapture={(dataUrl) => {
                setProfilePhoto(dataUrl);
                setPhotoError(null);
              }}
              onClear={() => setProfilePhoto(null)}
            />
            <span className="auth-field-error" data-testid="error-photo">
              {photoError ?? ''}
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
              {submitting ? 'Inscription…' : "S'inscrire"}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="auth-footer">
          Vous êtes grossiste ?{' '}
          <Link to="/register-wholesaler">Inscription grossiste</Link>
        </p>
        <p className="auth-footer">
          Déjà un compte ?{' '}
          <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
