import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import '../primitives/auth.css';

interface ProtectedRouteProps {
  /** Roles allowed to access this route group. Empty/undefined = any authenticated user. */
  allowedRoles?: string[] | undefined;
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();

  /* ── Loading state: discreet brown spinner ───────── */
  if (loading) {
    return (
      <div className="auth-guard-loading" data-testid="guard-loading">
        <div className="auth-guard-spinner" role="status" aria-label="Chargement" />
      </div>
    );
  }

  /* ── Not authenticated → redirect to login ───────── */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  /* ── Role check (if specified) ───────────────────── */
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user!.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
