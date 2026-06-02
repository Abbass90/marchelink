/* ================================================================
   MarchéLink — Configuration centralisée du site
   Point unique de vérité pour : logo, liens externes, contact,
   fondateurs et navigation publique. Modifier ICI uniquement.
   ================================================================ */

/** Marque (mark) du logo — remplacer ce fichier pour rebrander. */
export const LOGO_MARK_SRC = '/logos/marchelink-mark.svg';

/** Nom de marque affiché à côté du mark dans le lockup. */
export const BRAND_NAME = 'MarchéLink';

/** Service de livraison tiers (intégration API future). */
export const SWIFTGO_URL = 'https://swiftgo.vip';

/** Fondateurs — l'URL n'est JAMAIS affichée dans l'interface.
 *  TODO: remplacer par les vraies URLs de profil LinkedIn. */
export interface Founder {
  name: string;
  linkedin: string;
}

export const FOUNDERS: readonly Founder[] = [
  { name: 'Abbas Kanso', linkedin: 'https://www.linkedin.com/in/abbas-kanso' },
  { name: 'Jaafar Seklawi', linkedin: 'https://www.linkedin.com/in/jaafar-seklawi' },
] as const;

/** Bloc contact — structure simple, facile à éditer. */
export const CONTACT = {
  email: 'contact@marchelink.xyz',
  location: `Abidjan, Côte d'Ivoire`,
} as const;

/** Liens de navigation publics du footer. */
export const FOOTER_NAV: readonly { label: string; href: string }[] = [
  { label: 'Accueil', href: '/' },
  { label: 'Catalogue', href: '/buyer/catalog' },
  { label: 'Inscription', href: '/register' },
  { label: 'Connexion', href: '/login' },
] as const;
