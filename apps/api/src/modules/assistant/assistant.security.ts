import { logger } from '../../config/logger.js';

/**
 * Sécurité anti prompt-injection de l'assistant IA.
 *
 * ⚠️ DÉFENSE EN PROFONDEUR — ce filtre n'est qu'une PREMIÈRE barrière. La vraie
 * protection vit dans la couche outils : chaque outil est scopé à l'acheteur du
 * JWT, l'isolation tenant est appliquée en base, les arguments d'écriture sont
 * validés par Zod et toute commande exige une confirmation. Même une injection
 * qui passerait ce filtre ne peut donc NI franchir un tenant, NI agir pour un
 * autre acheteur, NI écrire autre chose qu'une commande « en attente »
 * appartenant à l'acheteur connecté (et annulable par lui).
 *
 * Les patterns restent volontairement CONSERVATEURS : on ne bloque que des
 * tournures manifestes de détournement, pour ne pas gêner une vraie conversation
 * commerce (« ignore les produits chers », « montre-moi les prix »… ne matchent
 * pas).
 */

const INJECTION_PATTERNS: RegExp[] = [
  // Ignorer / oublier les consignes
  /ignor\w*\s+[a-zàâéèêëîïôûùç'’\s]{0,20}?(?:instructions?|consignes?|r[èe]gles?|directives?|prompt|s[ée]curit[ée])/i,
  /(?:oubli\w+|disregard|forget)\s+[a-zàâéèêëîïôûùç'’\s]{0,20}?(?:instructions?|consignes?|r[èe]gles?|prompt|everything|tout)/i,
  // Prompt système / exfiltration des consignes
  /(?:syst[èe]me?|system)\s+(?:prompt|message|instructions?)/i,
  /(?:r[ée]v[èe]l\w+|affiche\w*|montre[- ]moi|repeat|reveal|print)\s+[a-zàâéèêëîïôûùç'’\s]{0,20}?(?:prompt|consignes?|instructions?\s+(?:syst|init))/i,
  // Réassignation de rôle / jailbreak
  /tu\s+es\s+(?:d[ée]sormais|maintenant)\s+(?:un|une|le|la|l['’]|libre|autoris)/i,
  /you\s+are\s+now\s+(?:a|an|the|free|allowed|unrestricted|dan)/i,
  /\b(?:DAN|jailbreak|developer\s+mode|mode\s+d[ée]veloppeur)\b/i,
  // Bypass explicite des restrictions
  /sans\s+(?:aucune\s+)?(?:restriction|limite|filtre|r[èe]gle|s[ée]curit[ée])/i,
  /(?:bypass|contourn\w+|outrepass\w+)\s+[a-zàâéèêëîïôûùç'’\s]{0,20}?(?:s[ée]curit|restriction|r[èe]gle|filtre|consigne)/i,
  // Nouvelles instructions imposées
  /(?:nouvelles?\s+instructions?|new\s+(?:instructions?|rules?))\s*[:：]/i,
];

export interface InjectionCheck {
  flagged: boolean;
  pattern?: string;
}

/** Repère une tentative manifeste de détournement dans un texte utilisateur. */
export function detectPromptInjection(text: string): InjectionCheck {
  for (const re of INJECTION_PATTERNS) {
    if (re.test(text)) {
      return { flagged: true, pattern: re.source };
    }
  }
  return { flagged: false };
}

/** Réponse neutre renvoyée quand une tentative de détournement est détectée. */
export const INJECTION_REFUSAL =
  "Je suis l'assistant MarchéLink et je reste sur mon rôle : t'aider à trouver des produits, suivre tes commandes ou en passer une. Dis-moi simplement ce que tu cherches.";

/** Journalise (pino, §22-24) une tentative bloquée, sans donnée sensible. */
export function logInjectionAttempt(params: {
  userId: string;
  correlationId?: string | undefined;
  pattern?: string | undefined;
}): void {
  logger.warn(
    {
      event: 'assistant.prompt_injection_blocked',
      user_id: params.userId,
      correlation_id: params.correlationId,
      matched_pattern: params.pattern,
    },
    "Tentative de prompt-injection bloquée sur l'assistant",
  );
}
