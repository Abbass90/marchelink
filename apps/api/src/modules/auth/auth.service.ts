import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { AuthRepository } from './auth.repository.js';
import type { Knex } from 'knex';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import type { RegisterBuyerInput, LoginInput, RegisterWholesalerInput, UpdateProfileInput, ChangePasswordInput } from './auth.schema.js';
import { EmailService } from '../../email/email.service.js';
import { logger } from '../../config/logger.js';

/** Durée de validité du token de vérification d'email : 24 heures */
const EMAIL_VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const BCRYPT_ROUNDS = 12;

export interface TokenPayload {
  sub: string;
  role: string;
  org: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  private readonly emailService: EmailService;

  constructor(
    private readonly repo: AuthRepository,
    private readonly db?: Knex,
  ) {
    this.accessSecret = process.env.JWT_ACCESS_SECRET!;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET!;
    this.accessTtl = Number(process.env.JWT_ACCESS_TTL_SEC ?? 900);
    this.refreshTtl = Number(process.env.JWT_REFRESH_TTL_SEC ?? 604800);
    this.emailService = new EmailService();
  }

  async register(input: RegisterBuyerInput): Promise<{ userId: string }> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      // Compte déjà vérifié → vraie collision : on refuse l'inscription.
      if (existing.email_verified_at) {
        throw new ValidationError('Email already registered');
      }
      // Compte existant mais email jamais vérifié (ex. le 1er mail n'est pas arrivé).
      // On rafraîchit le compte et on renvoie un nouvel email de vérification —
      // sans recréer le compte. Sûr car la propriété de l'email n'est pas prouvée.
      const refreshedHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      await this.repo.updateUser(existing.id, {
        password_hash: refreshedHash,
        first_name: input.first_name,
        last_name: input.last_name,
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      });
      await this.sendEmailVerification(existing.id, existing.email, input.first_name);
      return { userId: existing.id };
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await this.repo.createUser({
      email: input.email,
      password_hash: passwordHash,
      role: 'buyer',
      first_name: input.first_name,
      last_name: input.last_name,
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.profile_photo !== undefined ? { profile_photo: input.profile_photo } : {}),
      organization_id: null,
    });

    // Envoyer l'email de vérification
    await this.sendEmailVerification(user.id, user.email, user.first_name);

    return { userId: user.id };
  }

  /** Génère un token, l'enregistre (haché) et envoie l'email de vérification. */
  private async sendEmailVerification(userId: string, email: string, firstName: string): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TOKEN_TTL_MS);

    await this.repo.saveEmailVerificationToken({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });

    // Envoi en FIRE-AND-FORGET : la réponse HTTP d'inscription ne doit JAMAIS
    // attendre le SMTP. Sans cela, si le serveur SMTP est lent ou non configuré,
    // la requête /auth/register reste suspendue (~2 min) et le bouton tourne en
    // boucle côté client. Ici l'inscription a déjà réussi (token sauvegardé) ;
    // si l'envoi échoue, l'utilisateur pourra redemander un email plus tard.
    void this.emailService
      .sendVerificationEmail({ to: email, firstName, token: rawToken })
      .catch((err: unknown) => {
        // best-effort — l'échec d'envoi ne remet pas en cause l'inscription,
        // mais on le trace pour pouvoir diagnostiquer un SMTP mal configuré.
        logger.warn(
          { err, to: email },
          "Échec d'envoi de l'email de vérification (SMTP) — inscription conservée",
        );
      });
  }

  /** Valide le token reçu par email et marque l'email comme vérifié. */
  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.repo.findEmailVerificationToken(tokenHash);

    if (!record) {
      throw new ValidationError('Lien de vérification invalide ou déjà utilisé');
    }
    if (record.expires_at < new Date()) {
      throw new ValidationError('Lien de vérification expiré — veuillez vous réinscrire ou contacter le support');
    }

    await Promise.all([
      this.repo.markEmailVerificationTokenUsed(record.id),
      this.repo.setEmailVerified(record.user_id),
    ]);
  }

  async registerWholesaler(input: RegisterWholesalerInput): Promise<{ userId: string; organizationId: string }> {
    if (!this.db) {
      throw new Error('Database instance required for registerWholesaler');
    }

    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      // Compte grossiste non vérifié → renvoyer un nouvel email (org déjà créée).
      if (!existing.email_verified_at && existing.organization_id) {
        const refreshedHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
        await this.repo.updateUser(existing.id, {
          password_hash: refreshedHash,
          first_name: input.first_name,
          last_name: input.last_name,
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        });
        await this.sendEmailVerification(existing.id, existing.email, input.first_name);
        return { userId: existing.id, organizationId: existing.organization_id };
      }
      throw new ValidationError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const trx = await this.db.transaction();
    try {
      const org = await this.repo.createOrganization(input.organization_name, undefined, trx);

      const user = await this.repo.createUserInTrx(
        {
          email: input.email,
          password_hash: passwordHash,
          role: 'wholesaler_admin',
          first_name: input.first_name,
          last_name: input.last_name,
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          organization_id: org.id,
        },
        trx,
      );

      await trx('organizations')
        .where({ id: org.id })
        .update({ created_by: user.id, updated_by: user.id });

      await trx.commit();

      // Envoyer l'email de vérification après commit réussi
      await this.sendEmailVerification(user.id, user.email, user.first_name);

      return { userId: user.id, organizationId: org.id };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.repo.findByEmail(input.email);
    if (!user) {
      throw new NotFoundError('Invalid credentials');
    }

    const valid = await bcrypt.compare(input.password, user.password_hash);
    if (!valid) {
      throw new NotFoundError('Invalid credentials');
    }

    // Bloquer la connexion si l'email n'a pas encore été vérifié
    if (!user.email_verified_at) {
      throw new ValidationError('Veuillez confirmer votre adresse email avant de vous connecter. Vérifiez votre boîte mail.');
    }

    return this.generateTokens(user.id, user.role, user.organization_id);
  }

  async refresh(currentRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(currentRefreshToken);
    const stored = await this.repo.findRefreshToken(tokenHash);

    if (!stored || stored.expires_at < new Date()) {
      throw new NotFoundError('Invalid or expired refresh token');
    }

    // RTR: revoke the used token
    await this.repo.revokeRefreshToken(tokenHash);

    const user = await this.repo.findById(stored.user_id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.generateTokens(user.id, user.role, user.organization_id);
  }

  async getProfile(userId: string): Promise<{
    id: string;
    email: string;
    role: string;
    organization_id: string | null;
    first_name: string;
    last_name: string;
    phone: string | null;
    profile_photo: string | null;
  }> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      profile_photo: user.profile_photo,
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<{
    id: string;
    email: string;
    role: string;
    organization_id: string | null;
    first_name: string;
    last_name: string;
    phone: string | null;
  }> {
    // Collect only provided fields
    const updateData: { first_name?: string; last_name?: string; email?: string; phone?: string | null } = {};
    if (input.first_name !== undefined) updateData.first_name = input.first_name;
    if (input.last_name !== undefined) updateData.last_name = input.last_name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;

    // If nothing provided, return current profile unchanged
    if (Object.keys(updateData).length === 0) {
      return this.getProfile(userId);
    }

    // Email uniqueness check — CLAUDE.md §14: return 404 if cross-tenant; 422 for own-tenant duplicate
    if (updateData.email) {
      const existing = await this.repo.findByEmail(updateData.email);
      if (existing && existing.id !== userId) {
        throw new ValidationError('Email already in use');
      }
    }

    const updated = await this.repo.updateUser(userId, updateData);
    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      organization_id: updated.organization_id,
      first_name: updated.first_name,
      last_name: updated.last_name,
      phone: updated.phone,
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const valid = await bcrypt.compare(input.old_password, user.password_hash);
    if (!valid) {
      throw new ValidationError('Mot de passe actuel incorrect');
    }

    const newHash = await bcrypt.hash(input.new_password, BCRYPT_ROUNDS);
    await this.repo.updateUser(userId, { password_hash: newHash });

    // Revoke all refresh tokens → force re-auth after password change (security best-practice)
    await this.repo.revokeAllUserTokens(userId);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await this.repo.revokeRefreshToken(tokenHash);
  }

  private async generateTokens(userId: string, role: string, orgId: string | null): Promise<AuthTokens> {
    const payload: TokenPayload = { sub: userId, role, org: orgId };

    const accessToken = jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessTtl,
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTtl * 1000);

    await this.repo.saveRefreshToken({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
