import { useState } from 'react';
import '../primitives/hero.css';

type ButtonState = 'idle' | 'loading' | 'error';

function ActivityChart() {
  return (
    <svg width="120" height="40" viewBox="0 0 120 40" fill="none" aria-hidden="true">
      <polyline
        className="chart-line"
        points="0,35 15,30 30,32 45,22 60,18 75,24 90,10 105,14 120,5"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="0,35 15,30 30,32 45,22 60,18 75,24 90,10 105,14 120,5 120,40 0,40"
        fill="url(#chartGrad)"
        opacity="0.15"
      />
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FloatingCards() {
  return (
    <div className="hero-floating-container">
      {/* Card A — Dashboard / Stock */}
      <div className="hero-floating-card hero-floating-card-a">
        <div className="floating-card-header">
          <span className="floating-card-label">Activité du jour</span>
          <span className="floating-card-badge">+24%</span>
        </div>
        <ActivityChart />
        <div className="floating-card-row">
          <span className="floating-card-stat">32 commandes</span>
          <span className="floating-card-stat-muted">480 000 XOF</span>
        </div>
      </div>

      {/* Card B — Livraison vivante */}
      <div className="hero-floating-card hero-floating-card-b">
        <div className="floating-card-row">
          <span className="pulse-dot" />
          <span className="floating-card-live-label">En cours</span>
        </div>
        <p className="floating-card-delivery-text">
          Commande #2024 expédiée à Adjamé
        </p>
        <div className="floating-card-delivery-status">
          <span className="delivery-step delivery-step-done" />
          <span className="delivery-step delivery-step-done" />
          <span className="delivery-step delivery-step-active" />
          <span className="delivery-step" />
        </div>
      </div>

      {/* Card C — Stock alert */}
      <div className="hero-floating-card hero-floating-card-c">
        <div className="floating-card-row">
          <span className="floating-card-stock-icon">↓</span>
          <span className="floating-card-label">Stock mis à jour</span>
        </div>
        <p className="floating-card-stock-detail">
          Tissu Wax Hollandais — 12 restants
        </p>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const [ctaState, setCtaState] = useState<ButtonState>('idle');

  const handlePrimary = () => {
    setCtaState('loading');
    setTimeout(() => { window.location.href = '/buyer'; }, 400);
  };

  return (
    <section className="hero-section">
      <div className="hero-grid">
        {/* Left column */}
        <div className="hero-left">
          <span className="hero-badge">
            <span className="hero-badge-dot" />
            Le marché d'Adjamé dans votre poche
          </span>

          <h1 className="hero-title">
            Connectez votre
            <br />
            <span className="hero-title-accent">commerce</span> au marché
          </h1>

          <p className="hero-subtitle">
            MarchéLink relie les grossistes d'Adjamé aux boutiquiers d'Abidjan.
            Commandez, payez et faites livrer — le tout depuis votre mobile.
          </p>

          <div className="hero-actions">
            <button
              className="hero-cta-primary"
              onClick={handlePrimary}
              disabled={ctaState === 'loading'}
            >
              {ctaState === 'loading' ? 'Chargement…' : 'Commencer maintenant'}
              {ctaState === 'idle' && <span className="cta-arrow">→</span>}
            </button>

            <button
              className="hero-cta-secondary"
              onClick={() => { window.location.href = '/wholesaler'; }}
            >
              Espace Grossiste
            </button>
          </div>
        </div>

        {/* Right column — Floating UI */}
        <div className="hero-right">
          <FloatingCards />
        </div>
      </div>

      {/* Organic gradient transition */}
      <div className="hero-gradient-bottom" />
    </section>
  );
}
