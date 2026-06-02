import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Home from '../Home.js';

/* ── Mock IntersectionObserver for jsdom ──────────────── */

const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  mockObserve.mockReset();
  mockUnobserve.mockReset();
  mockDisconnect.mockReset();

  global.IntersectionObserver = vi.fn((cb) => {
    /* Immediately trigger visible for every observed element */
    (global.IntersectionObserver as any).__callback = cb;
    return {
      observe: (el: Element) => {
        mockObserve(el);
        /* Auto-trigger as visible so count-ups and reveals fire */
        cb([{ target: el, isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver);
      },
      unobserve: mockUnobserve,
      disconnect: mockDisconnect,
    };
  }) as any;
});

describe('Home — Premium Landing Page', () => {
  /* ── Navbar ─────────────────────────────────────────── */

  describe('Navbar', () => {
    it('renders the navbar with brand name', () => {
      render(<Home />);
      const nav = screen.getByTestId('navbar');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveTextContent('MarchéLink');
    });

    it('renders portal navigation buttons', () => {
      render(<Home />);
      const nav = screen.getByTestId('navbar');
      expect(within(nav).getByRole('button', { name: /boutiquier/i })).toBeInTheDocument();
      expect(within(nav).getByRole('button', { name: 'Grossiste' })).toBeInTheDocument();
    });

    it('renders the CTA button in navbar', () => {
      render(<Home />);
      const nav = screen.getByTestId('navbar');
      expect(within(nav).getByRole('button', { name: /commencer/i })).toBeInTheDocument();
    });

    it('starts without glass effect class', () => {
      render(<Home />);
      const nav = screen.getByTestId('navbar');
      expect(nav.className).not.toContain('nav-glass');
    });
  });

  /* ── Hero Section ───────────────────────────────────── */

  describe('Hero Section', () => {
    it('renders the hero section', () => {
      render(<Home />);
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    });

    it('renders the pulsing badge text', () => {
      render(<Home />);
      expect(screen.getByText(/Le marché d'Adjamé dans votre poche/i)).toBeInTheDocument();
    });

    it('renders the main title', () => {
      render(<Home />);
      const hero = screen.getByTestId('hero-section');
      expect(within(hero).getByText(/Connectez votre/i)).toBeInTheDocument();
      expect(within(hero).getByText('commerce')).toBeInTheDocument();
      /* Check the h1 contains the full phrase */
      const h1 = hero.querySelector('.l-hero-title');
      expect(h1).toHaveTextContent(/au marché/i);
    });

    it('renders hero action buttons', () => {
      render(<Home />);
      expect(screen.getByRole('button', { name: /Commencer maintenant/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Espace Grossiste/i })).toBeInTheDocument();
    });

    it('renders floating UI cards with live data', () => {
      render(<Home />);
      expect(screen.getByText('Activité du jour')).toBeInTheDocument();
      expect(screen.getByText(/Commande #2024/i)).toBeInTheDocument();
      expect(screen.getByText(/Tissu Wax Hollandais/i)).toBeInTheDocument();
    });

    it('renders the activity chart SVG', () => {
      render(<Home />);
      const hero = screen.getByTestId('hero-section');
      const svg = hero.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  /* ── Market Categories ──────────────────────────────── */

  describe('Market Categories', () => {
    it('renders the categories section', () => {
      render(<Home />);
      expect(screen.getByTestId('categories-section')).toBeInTheDocument();
    });

    it('renders the section title', () => {
      render(<Home />);
      expect(screen.getByText(/Explorez nos catégories/i)).toBeInTheDocument();
    });

    it('renders exactly 4 category cards', () => {
      render(<Home />);
      const cards = screen.getAllByTestId('category-card');
      expect(cards).toHaveLength(4);
    });

    it('renders each category name', () => {
      render(<Home />);
      expect(screen.getByText('Alimentaire')).toBeInTheDocument();
      expect(screen.getByText('Textile')).toBeInTheDocument();
      expect(screen.getByText('Beauté')).toBeInTheDocument();
      expect(screen.getByText('Électronique')).toBeInTheDocument();
    });

    it('displays product counts', () => {
      render(<Home />);
      expect(screen.getByText('1 240+ produits')).toBeInTheDocument();
      expect(screen.getByText('860+ produits')).toBeInTheDocument();
    });
  });

  /* ── Stats Strip ────────────────────────────────────── */

  describe('Stats Strip', () => {
    it('renders the stats section', () => {
      render(<Home />);
      expect(screen.getByTestId('stats-section')).toBeInTheDocument();
    });

    it('renders 3 stat values', () => {
      render(<Home />);
      const statValues = screen.getAllByTestId('stat-value');
      expect(statValues).toHaveLength(3);
    });

    it('renders stat labels', () => {
      render(<Home />);
      expect(screen.getByText('Boutiquiers actifs')).toBeInTheDocument();
      expect(screen.getByText('Grossistes certifiés')).toBeInTheDocument();
      expect(screen.getByText('Transactions sécurisées')).toBeInTheDocument();
    });
  });

  /* ── Bento Feature Grid ─────────────────────────────── */

  describe('Bento Features', () => {
    it('renders the bento section', () => {
      render(<Home />);
      expect(screen.getByTestId('bento-section')).toBeInTheDocument();
    });

    it('renders the section title', () => {
      render(<Home />);
      expect(screen.getByText(/Infrastructure robuste/i)).toBeInTheDocument();
    });

    it('renders exactly 5 bento cards', () => {
      render(<Home />);
      const cards = screen.getAllByTestId('bento-card');
      expect(cards).toHaveLength(5);
    });

    it('renders all feature titles', () => {
      render(<Home />);
      expect(screen.getByText(/Validation de stock/i)).toBeInTheDocument();
      expect(screen.getByText(/Panier mono-grossiste/i)).toBeInTheDocument();
      expect(screen.getByText(/Isolation multi-tenant/i)).toBeInTheDocument();
      expect(screen.getByText(/Mobile Money sécurisé/i)).toBeInTheDocument();
      expect(screen.getByText(/Tableau de bord intelligent/i)).toBeInTheDocument();
    });

    it('contains wide cards with correct CSS class', () => {
      render(<Home />);
      const cards = screen.getAllByTestId('bento-card');
      const wideCards = cards.filter((c) => c.className.includes('l-bento-card--wide'));
      expect(wideCards.length).toBe(2);
    });
  });

  /* ── How It Works ───────────────────────────────────── */

  describe('How It Works', () => {
    it('renders the section', () => {
      render(<Home />);
      expect(screen.getByTestId('howitworks-section')).toBeInTheDocument();
    });

    it('renders exactly 4 step cards', () => {
      render(<Home />);
      const steps = screen.getAllByTestId('step-card');
      expect(steps).toHaveLength(4);
    });

    it('renders step titles', () => {
      render(<Home />);
      expect(screen.getByText('Inscrivez-vous')).toBeInTheDocument();
      expect(screen.getByText('Parcourez')).toBeInTheDocument();
      expect(screen.getByText('Commandez')).toBeInTheDocument();
      expect(screen.getByText('Recevez')).toBeInTheDocument();
    });

    it('renders step numbers 1 through 4', () => {
      render(<Home />);
      const steps = screen.getAllByTestId('step-card');
      steps.forEach((card, i) => {
        expect(within(card).getByText(String(i + 1))).toBeInTheDocument();
      });
    });
  });

  /* ── Testimonials ───────────────────────────────────── */

  describe('Testimonials', () => {
    it('renders the testimonials section', () => {
      render(<Home />);
      expect(screen.getByTestId('testimonials-section')).toBeInTheDocument();
    });

    it('renders exactly 3 testimonial cards', () => {
      render(<Home />);
      const cards = screen.getAllByTestId('testimonial-card');
      expect(cards).toHaveLength(3);
    });

    it('renders testimonial author names', () => {
      render(<Home />);
      expect(screen.getByText('Aminata K.')).toBeInTheDocument();
      expect(screen.getByText('Ibrahim D.')).toBeInTheDocument();
      expect(screen.getByText('Fatou S.')).toBeInTheDocument();
    });

    it('renders testimonial roles', () => {
      render(<Home />);
      expect(screen.getByText(/Boutiquière, Yopougon/i)).toBeInTheDocument();
      expect(screen.getByText(/Grossiste, Adjamé/i)).toBeInTheDocument();
      expect(screen.getByText(/Commerçante, Cocody/i)).toBeInTheDocument();
    });
  });

  /* ── Footer ─────────────────────────────────────────── */

  describe('Footer', () => {
    it('renders the footer', () => {
      render(<Home />);
      expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    it('renders location in contact block', () => {
      render(<Home />);
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveTextContent(/Abidjan/);
      expect(footer).toHaveTextContent(/Côte d'Ivoire/);
    });

    it('renders current year in bottom bar', () => {
      render(<Home />);
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveTextContent(new Date().getFullYear().toString());
    });

    it('renders brand name in bottom bar', () => {
      render(<Home />);
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveTextContent(/MarchéLink/);
    });

    it('renders all navigation links', () => {
      render(<Home />);
      const footer = screen.getByTestId('footer');
      expect(within(footer).getByText('Accueil')).toBeInTheDocument();
      expect(within(footer).getByText('Catalogue')).toBeInTheDocument();
      expect(within(footer).getByText('Inscription')).toBeInTheDocument();
      expect(within(footer).getByText('Connexion')).toBeInTheDocument();
    });

    it('renders contact email', () => {
      render(<Home />);
      expect(screen.getByTestId('footer-email')).toHaveTextContent('contact@marchelink.xyz');
    });

    it('renders both founders with LinkedIn buttons', () => {
      render(<Home />);
      const btns = screen.getAllByTestId('founder-linkedin');
      expect(btns).toHaveLength(2);
      expect(btns[0]).toHaveTextContent('Abbas Kanso');
      expect(btns[1]).toHaveTextContent('Jaafar Seklawi');
    });

    it('LinkedIn buttons open in new tab with noopener', () => {
      render(<Home />);
      const btns = screen.getAllByTestId('founder-linkedin');
      btns.forEach((btn) => {
        expect(btn).toHaveAttribute('target', '_blank');
        expect(btn).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('LinkedIn URLs are not visible as text', () => {
      render(<Home />);
      const footer = screen.getByTestId('footer');
      expect(footer).not.toHaveTextContent('linkedin.com');
    });
  });

  /* ── Background & Reveal ────────────────────────────── */

  describe('Background & Reveal system', () => {
    it('renders decorative background blobs', () => {
      const { container } = render(<Home />);
      const blobs = container.querySelectorAll('.landing-blob');
      expect(blobs.length).toBe(2);
    });

    it('IntersectionObserver is instantiated for reveal elements', () => {
      render(<Home />);
      expect(mockObserve).toHaveBeenCalled();
    });

    it('reveal elements get .visible class when intersecting', () => {
      const { container } = render(<Home />);
      const reveals = container.querySelectorAll('.reveal');
      reveals.forEach((el) => {
        expect(el.classList.contains('visible')).toBe(true);
      });
    });
  });
});
