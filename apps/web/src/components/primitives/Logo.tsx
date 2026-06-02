import { LOGO_MARK_SRC, BRAND_NAME } from '../../config/site.js';
import './logo.css';

interface LogoProps {
  /** 'full' = mark + wordmark ; 'mark' = monogramme seul. */
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg';
  /** 'light' = wordmark clair (sur fond foncé/primary). */
  tone?: 'dark' | 'light';
  className?: string;
}

/**
 * Logo de marque MarchéLink. Structure swappable : la source du mark vient de
 * la config centralisée (LOGO_MARK_SRC) — remplacer le fichier SVG suffit à
 * rebrander, sans toucher au code.
 */
export default function Logo({ variant = 'full', size = 'md', tone = 'dark', className }: LogoProps) {
  return (
    <span
      className={`ml-logo ml-logo--${size}${tone === 'light' ? ' ml-logo--light' : ''}${className ? ` ${className}` : ''}`}
      data-testid="brand-logo"
    >
      <img className="ml-logo-mark" src={LOGO_MARK_SRC} alt={BRAND_NAME} />
      {variant === 'full' && (
        <span className="ml-logo-word" aria-hidden="true">
          Marché<span className="ml-logo-word-accent">Link</span>
        </span>
      )}
    </span>
  );
}
