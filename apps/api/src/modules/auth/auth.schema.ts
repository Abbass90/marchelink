import { z } from 'zod';

/* ── Ivorian phone validation ──────────────────────────
   Normalise vers +225XXXXXXXXXX (14 chars).
   Accepte :
     - 10 chiffres locaux  : 0700000000  → +2250700000000
     - +225 + 10 chiffres  : +2250700000000 (inchangé)
     - 00225 + 10 chiffres : 002250700000000 → +2250700000000
   Les espaces, tirets, points et parenthèses sont ignorés.
   ─────────────────────────────────────────────────── */

function normalizeIvorianPhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-\.\(\)]/g, '');
  let digits: string;

  if (stripped.startsWith('+225')) {
    digits = stripped.slice(4);
  } else if (stripped.startsWith('00225')) {
    digits = stripped.slice(5);
  } else if (stripped.startsWith('225') && stripped.length === 13) {
    digits = stripped.slice(3);
  } else {
    digits = stripped;
  }

  if (!/^\d{10}$/.test(digits)) return null;
  return `+225${digits}`;
}

/** Schéma Zod : numéro ivoirien obligatoire, normalisé vers +225XXXXXXXXXX. */
const ivorianPhoneSchema = z
  .string({ required_error: 'Le numéro de téléphone est requis' })
  .min(1, 'Le numéro de téléphone est requis')
  .transform((val, ctx) => {
    const normalized = normalizeIvorianPhone(val);
    if (normalized === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Numéro ivoirien invalide — ex : 07 00 00 00 00 ou +225 07 00 00 00 00',
      });
      return z.NEVER;
    }
    return normalized;
  });

export const RegisterBuyerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: ivorianPhoneSchema,
  /** Data-URL base64 JPEG issu de la caméra — optionnel côté API, obligatoire côté formulaire. */
  profile_photo: z.string().min(1).optional(),
});

export type RegisterBuyerInput = z.infer<typeof RegisterBuyerSchema>;

export const LoginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterWholesalerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: ivorianPhoneSchema,
  organization_name: z.string().min(1).max(255),
});

export type RegisterWholesalerInput = z.infer<typeof RegisterWholesalerSchema>;

export const UpdateProfileSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(320).optional(),
  /* Phone peut être mis à jour (avec validation) mais plus mis à null — §9 NOT NULL. */
  phone: ivorianPhoneSchema.optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z.object({
  old_password: z.string().min(1).max(128),
  new_password: z.string().min(8).max(128),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
