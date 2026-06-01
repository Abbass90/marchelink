import { useState, useEffect, useRef, useCallback } from 'react';
import '../components/primitives/landing.css';

/* ══════════════════════════════════════════════════════
   MarcheLink — Premium Landing Page
   6 sections: Navbar, Hero, Categories, Stats, Bento, HowItWorks+Testimonials
   ══════════════════════════════════════════════════════ */

/* ── Data ─────────────────────────────────────────────── */

const CATEGORIES = [
  { icon: '🥑', name: 'Alimentaire', count: '1 240+ produits' },
  { icon: '🧵', name: 'Textile', count: '860+ produits' },
  { icon: '✨', name: 'Beauté', count: '540+ produits' },
  { icon: '📱', name: 'Électronique', count: '320+ produits' },
] as const;

const STATS = [
  { value: 2800, suffix: '+', label: 'Acheteurs actifs' },
  { value: 150, suffix: '', label: 'Grossistes certifiés' },
  { value: 100, suffix: '%', label: 'Transactions sécurisées' },
] as const;

const BENTO_FEATURES = [
  {
    icon: '📦',
    title: 'Validation de stock en temps réel',
    desc: 'Chaque commande vérifie et décrémente le stock dans une transaction atomique. Zéro survente possible.',
    wide: true,
  },
  {
    icon: '🛒',
    title: 'Panier mono-grossiste',
    desc: 'Un panier par grossiste pour une logistique claire. Pas de mélanges, pas de confusion.',
    wide: false,
  },
  {
    icon: '🔒',
    title: 'Isolation multi-tenant',
    desc: 'Chaque organisation est cloisonnée. Aucune fuite de données entre grossistes — les accès hors périmètre retournent 404.',
    wide: false,
  },
  {
    icon: '💰',
    title: 'Mobile Money sécurisé',
    desc: 'Webhooks idempotents avec clé unique par transaction. Un rejeu ne duplique jamais un paiement.',
    wide: true,
  },
  {
    icon: '📊',
    title: 'Tableau de bord intelligent',
    desc: 'Suivi des ventes, alertes de stock et analyses de performance en temps réel pour chaque grossiste.',
    wide: false,
  },
] as const;

const STEPS = [
  { num: '1', title: 'Inscrivez-vous', desc: 'Créez votre compte acheteur ou grossiste en quelques secondes.' },
  { num: '2', title: 'Parcourez', desc: 'Explorez les catalogues de tous les grossistes du marché.' },
  { num: '3', title: 'Commandez', desc: 'Ajoutez au panier, payez en Mobile Money et confirmez.' },
  { num: '4', title: 'Recevez', desc: 'Suivez votre livraison en temps réel jusqu\'a votre boutique.' },
] as const;

const TESTIMONIALS = [
  {
    quote: 'Depuis MarchéLink, je commande mes tissus sans me déplacer. Je gagne 3h par semaine.',
    name: 'Aminata K.',
    role: 'Boutiquière, Yopougon',
    avatar: '👩🏾',
  },
  {
    quote: 'Mon chiffre d\'affaires a augmenté de 40% grâce à la visibilité sur la plateforme.',
    name: 'Ibrahim D.',
    role: 'Grossiste, Adjamé',
    avatar: '👨🏾',
  },
  {
    quote: 'Les livraisons sont traçables et les paiements sécurisés. C\'est ce qui manquait au marché.',
    name: 'Fatou S.',
    role: 'Commerçante, Cocody',
    avatar: '👩🏾‍💼',
  },
] as const;

/* ── Hooks ────────────────────────────────────────────── */

function useScrolledPast(threshold: number) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrolled;
}

function useRevealObserver() {
  useEffect(() => {
    const elements = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' },
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);
}

function useCountUp(end: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();

          const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration]);

  return { count, ref };
}

/* ── Sub-components ───────────────────────────────────── */

function ActivityChart() {
  return (
    <svg width="120" height="40" viewBox="0 0 120 40" fill="none" aria-hidden="true">
      <polyline
        className="l-chart-line"
        points="0,35 15,30 30,32 45,22 60,18 75,24 90,10 105,14 120,5"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="0,35 15,30 30,32 45,22 60,18 75,24 90,10 105,14 120,5 120,40 0,40"
        fill="url(#lChartGrad)"
        opacity="0.12"
      />
      <defs>
        <linearGradient id="lChartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HeroFloatingCards() {
  return (
    <div className="l-hero-float-wrap">
      {/* Card A — Dashboard */}
      <div className="l-float-card l-float-card--a">
        <div className="l-float-header">
          <span className="l-float-label">Activité du jour</span>
          <span className="l-float-badge">+24%</span>
        </div>
        <ActivityChart />
        <div className="l-float-row">
          <span className="l-float-stat">32 commandes</span>
          <span className="l-float-stat-muted">480 000 XOF</span>
        </div>
      </div>

      {/* Card B — Live delivery */}
      <div className="l-float-card l-float-card--b">
        <div className="l-float-row">
          <span className="l-pulse-dot" />
          <span className="l-float-live">En cours</span>
        </div>
        <p className="l-float-delivery-text">Commande #2024 expédiée à Adjamé</p>
        <div className="l-delivery-steps">
          <span className="l-delivery-step l-delivery-step--done" />
          <span className="l-delivery-step l-delivery-step--done" />
          <span className="l-delivery-step l-delivery-step--active" />
          <span className="l-delivery-step" />
        </div>
      </div>

      {/* Card C — Stock alert */}
      <div className="l-float-card l-float-card--c">
        <div className="l-float-row">
          <span className="l-float-stock-icon">↓</span>
          <span className="l-float-label">Stock mis à jour</span>
        </div>
        <p className="l-float-stock-detail">Tissu Wax Hollandais — 12 restants</p>
      </div>
    </div>
  );
}

function StatItem({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { count, ref } = useCountUp(value);
  return (
    <div className="l-stat-item" ref={ref}>
      <div className="l-stat-value" data-testid="stat-value">
        {count.toLocaleString('fr-FR')}{suffix}
      </div>
      <div className="l-stat-label">{label}</div>
    </div>
  );
}

/* ── Main Page Component ──────────────────────────────── */

export default function Home() {
  const navScrolled = useScrolledPast(30);
  useRevealObserver();

  const handleNavigate = useCallback((path: string) => {
    window.location.href = path;
  }, []);

  return (
    <div className="landing-root">
      {/* Background decorative blobs */}
      <div className="landing-blob landing-blob--brown" aria-hidden="true" />
      <div className="landing-blob landing-blob--beige" aria-hidden="true" />

      {/* ── 1. Navbar ──────────────────────────────────── */}
      <nav className={`l-nav${navScrolled ? ' nav-glass' : ''}`} data-testid="navbar">
        <div className="l-nav-inner">
          <div className="l-nav-brand">
            Marché<span>Link</span>
          </div>
          <div className="l-nav-links">
            <button className="l-nav-link" onClick={() => handleNavigate('/buyer')}>
              Acheteur
            </button>
            <button className="l-nav-link" onClick={() => handleNavigate('/wholesaler')}>
              Grossiste
            </button>
            <button className="l-nav-cta" onClick={() => handleNavigate('/buyer')}>
              Commencer <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── 2. Hero Section ────────────────────────────── */}
      <section className="l-hero" data-testid="hero-section">
        <div className="l-hero-grid">
          <div className="l-hero-left">
            <span className="l-hero-badge">
              <span className="l-hero-badge-dot" />
              Le marché d&apos;Adjamé dans votre poche
            </span>

            <h1 className="l-hero-title">
              Connectez votre<br />
              <span className="l-hero-title-accent">commerce</span> au marché
            </h1>

            <p className="l-hero-subtitle">
              MarchéLink relie les grossistes d&apos;Adjamé aux boutiquiers d&apos;Abidjan.
              Commandez, payez et faites livrer — le tout depuis votre mobile.
            </p>

            <div className="l-hero-actions">
              <button className="l-btn-primary" onClick={() => handleNavigate('/buyer')}>
                Commencer maintenant <span aria-hidden="true">→</span>
              </button>
              <button className="l-btn-secondary" onClick={() => handleNavigate('/wholesaler')}>
                Espace Grossiste
              </button>
            </div>
          </div>

          <div className="l-hero-right">
            <HeroFloatingCards />
          </div>
        </div>
        <div className="l-hero-fade" />
      </section>

      {/* ── 3. Market Categories ───────────────────────── */}
      <section className="l-section l-section--beige" data-testid="categories-section">
        <div className="l-section-inner">
          <div className="l-section-header reveal">
            <h2 className="l-section-title">Explorez nos catégories</h2>
            <p className="l-section-subtitle">
              Les meilleurs produits du marché d&apos;Adjamé, organisés pour vous.
            </p>
          </div>
          <div className="l-categories-grid">
            {CATEGORIES.map((cat, i) => (
              <div
                key={cat.name}
                className={`l-cat-card reveal reveal-delay-${i + 1}`}
                data-testid="category-card"
              >
                <span className="l-cat-icon">{cat.icon}</span>
                <h3 className="l-cat-name">{cat.name}</h3>
                <p className="l-cat-count">{cat.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Stats Strip ─────────────────────────────── */}
      <section className="l-section l-section--white" data-testid="stats-section">
        <div className="l-section-inner">
          <div className="l-stats-strip reveal">
            {STATS.map((stat) => (
              <StatItem key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Bento Feature Grid ──────────────────────── */}
      <section className="l-section l-section--beige" data-testid="bento-section">
        <div className="l-section-inner">
          <div className="l-section-header reveal">
            <h2 className="l-section-title">Infrastructure robuste</h2>
            <p className="l-section-subtitle">
              Conçu pour le commerce réel — chaque composant est pensé pour la fiabilité.
            </p>
          </div>
          <div className="l-bento-grid">
            {BENTO_FEATURES.map((feat, i) => (
              <div
                key={feat.title}
                className={`l-bento-card${feat.wide ? ' l-bento-card--wide' : ''} reveal reveal-delay-${(i % 4) + 1}`}
                data-testid="bento-card"
              >
                <div className="l-bento-icon">{feat.icon}</div>
                <h3 className="l-bento-title">{feat.title}</h3>
                <p className="l-bento-desc">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. How it Works ────────────────────────────── */}
      <section className="l-section l-section--white" data-testid="howitworks-section">
        <div className="l-section-inner">
          <div className="l-section-header reveal">
            <h2 className="l-section-title">Comment ça marche</h2>
            <p className="l-section-subtitle">
              Quatre étapes simples pour digitaliser votre commerce.
            </p>
          </div>
          <div className="l-steps-grid">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={`l-step-card reveal reveal-delay-${i + 1}`}
                data-testid="step-card"
              >
                <div className="l-step-number">{step.num}</div>
                <h3 className="l-step-title">{step.title}</h3>
                <p className="l-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────── */}
      <section className="l-section l-section--beige" data-testid="testimonials-section">
        <div className="l-section-inner">
          <div className="l-section-header reveal">
            <h2 className="l-section-title">Ce qu&apos;ils en disent</h2>
            <p className="l-section-subtitle">
              Boutiquiers et grossistes partagent leur expérience.
            </p>
          </div>
          <div className="l-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className={`l-testimonial-card reveal reveal-delay-${i + 1}`}
                data-testid="testimonial-card"
              >
                <p className="l-testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="l-testimonial-author">
                  <div className="l-testimonial-avatar">{t.avatar}</div>
                  <div>
                    <div className="l-testimonial-name">{t.name}</div>
                    <div className="l-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="l-footer" data-testid="footer">
        <p className="l-footer-text">
          MarchéLink — Abidjan, Côte d&apos;Ivoire &middot; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
