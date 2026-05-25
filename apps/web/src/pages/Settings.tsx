import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { updateProfile, changePassword, ApiError } from '../api/client.js';
import '../components/primitives/catalog.css';

type St = 'idle' | 'loading' | 'success' | 'error';

export default function Settings() {
  const { user, reloadUser } = useAuth();

  const [prof, setProf] = useState({ first_name: user?.first_name ?? '', last_name: user?.last_name ?? '', email: user?.email ?? '', phone: user?.phone ?? '' });
  const [profSt, setProfSt] = useState<St>('idle');
  const [profErr, setProfErr] = useState('');
  const [pwd, setPwd] = useState({ old_password: '', new_password: '' });
  const [pwdSt, setPwdSt] = useState<St>('idle');
  const [pwdErr, setPwdErr] = useState('');

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfSt('loading');
    setProfErr('');
    try {
      const payload: Parameters<typeof updateProfile>[0] = {};
      if (prof.first_name) payload.first_name = prof.first_name;
      if (prof.last_name) payload.last_name = prof.last_name;
      if (prof.email) payload.email = prof.email;
      payload.phone = prof.phone !== '' ? prof.phone : null;
      await updateProfile(payload);
      await reloadUser();
      setProfSt('success');
    } catch (err) {
      setProfErr(err instanceof ApiError ? err.message : 'Erreur inattendue');
      setProfSt('error');
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.new_password.length < 8) {
      setPwdErr('Le nouveau mot de passe doit contenir au moins 8 caractères');
      setPwdSt('error');
      return;
    }
    setPwdSt('loading');
    setPwdErr('');
    try {
      await changePassword(pwd);
      setPwdSt('success');
      setPwd({ old_password: '', new_password: '' });
    } catch (err) {
      setPwdErr(err instanceof ApiError ? err.message : 'Erreur inattendue');
      setPwdSt('error');
    }
  }

  return (
    <div className="st-page">
      <h1 className="st-title">Paramètres du compte</h1>

      {/* ── Informations personnelles ── */}
      <section className="st-card">
        <h2 className="st-section-title">Informations personnelles</h2>
        <form className="st-form" onSubmit={(e) => void handleProfile(e)} noValidate>
          <div className="st-row">
            <label className="st-label">
              Prénom
              <input
                className="st-input"
                value={prof.first_name}
                onChange={(e) => setProf((p) => ({ ...p, first_name: e.target.value }))}
                data-testid="st-first-name"
              />
            </label>
            <label className="st-label">
              Nom
              <input
                className="st-input"
                value={prof.last_name}
                onChange={(e) => setProf((p) => ({ ...p, last_name: e.target.value }))}
                data-testid="st-last-name"
              />
            </label>
          </div>
          <label className="st-label">
            Email
            <input
              className="st-input"
              type="email"
              value={prof.email}
              onChange={(e) => setProf((p) => ({ ...p, email: e.target.value }))}
              data-testid="st-email"
            />
          </label>
          <label className="st-label">
            Téléphone
            <input
              className="st-input"
              type="tel"
              value={prof.phone}
              onChange={(e) => setProf((p) => ({ ...p, phone: e.target.value }))}
              data-testid="st-phone"
            />
          </label>
          {profSt === 'error' && <p className="st-error" data-testid="st-prof-error">{profErr}</p>}
          {profSt === 'success' && <p className="st-success" data-testid="st-prof-success">Profil mis à jour ✓</p>}
          <button className="st-btn" type="submit" disabled={profSt === 'loading'} data-testid="st-prof-submit">
            {profSt === 'loading' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </section>

      {/* ── Changer le mot de passe ── */}
      <section className="st-card">
        <h2 className="st-section-title">Changer le mot de passe</h2>
        <form className="st-form" onSubmit={(e) => void handlePassword(e)} noValidate>
          <label className="st-label">
            Mot de passe actuel
            <input
              className="st-input"
              type="password"
              value={pwd.old_password}
              onChange={(e) => setPwd((p) => ({ ...p, old_password: e.target.value }))}
              data-testid="st-old-pwd"
            />
          </label>
          <label className="st-label">
            Nouveau mot de passe
            <input
              className="st-input"
              type="password"
              value={pwd.new_password}
              onChange={(e) => setPwd((p) => ({ ...p, new_password: e.target.value }))}
              data-testid="st-new-pwd"
            />
          </label>
          {pwdSt === 'error' && <p className="st-error" data-testid="st-pwd-error">{pwdErr}</p>}
          {pwdSt === 'success' && <p className="st-success" data-testid="st-pwd-success">Mot de passe modifié ✓</p>}
          <button className="st-btn" type="submit" disabled={pwdSt === 'loading'} data-testid="st-pwd-submit">
            {pwdSt === 'loading' ? 'Modification…' : 'Modifier le mot de passe'}
          </button>
        </form>
      </section>
    </div>
  );
}
