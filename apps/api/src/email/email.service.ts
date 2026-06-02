import nodemailer from 'nodemailer';

/**
 * Service d'envoi d'emails via Brevo SMTP.
 * Les credentials sont lus depuis les variables d'environnement (config.js → process.env).
 */
export class EmailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;
  private readonly appBaseUrl: string;
  /** true seulement si host + user + pass sont tous présents dans l'environnement */
  private readonly configured: boolean;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    this.configured = Boolean(host && user && pass);
    this.fromAddress = process.env.SMTP_FROM ?? user ?? 'no-reply@marchelink.dev';
    this.appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5173';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // STARTTLS sur le port 587
      auth: user && pass ? { user, pass } : undefined,
      // Timeouts courts : en fire-and-forget, on ne veut pas qu'une socket
      // reste suspendue ~2 min (défaut nodemailer) si le SMTP est injoignable.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  /**
   * Envoie un email de vérification à l'utilisateur qui vient de s'inscrire.
   * Le lien contient le token brut (non haché) — valable 24h.
   */
  async sendVerificationEmail(params: {
    to: string;
    firstName: string;
    token: string;
  }): Promise<void> {
    // SMTP non configuré → on n'essaie même pas de se connecter (évite un hang
    // réseau). L'inscription reste valide ; l'email pourra être renvoyé plus tard.
    if (!this.configured) {
      return;
    }

    const verifyUrl = `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(params.token)}`;

    await this.transporter.sendMail({
      from: `"MarchéLink" <${this.fromAddress}>`,
      to: params.to,
      subject: 'Confirmez votre adresse email — MarchéLink',
      text: `Bonjour ${params.firstName},\n\nMerci de vous être inscrit sur MarchéLink.\n\nCliquez sur ce lien pour confirmer votre adresse email (valable 24 h) :\n${verifyUrl}\n\nSi vous n'avez pas créé de compte, ignorez ce message.\n\nL'équipe MarchéLink`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
          <tr>
            <td style="text-align:center;padding-bottom:32px">
              <h1 style="color:#1a1a1a;font-size:24px;margin:0">MarchéLink</h1>
            </td>
          </tr>
          <tr>
            <td style="color:#374151;font-size:16px;line-height:1.6">
              <p>Bonjour <strong>${params.firstName}</strong>,</p>
              <p>Merci de vous être inscrit sur <strong>MarchéLink</strong> ! Pour activer votre compte, confirmez votre adresse email en cliquant sur le bouton ci-dessous.</p>
              <p style="text-align:center;margin:32px 0">
                <a href="${verifyUrl}"
                   style="background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:bold;font-size:16px;display:inline-block">
                  Confirmer mon email
                </a>
              </p>
              <p style="color:#6b7280;font-size:14px">Ce lien expire dans <strong>24 heures</strong>.<br>Si vous n'avez pas créé de compte, ignorez simplement ce message.</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;text-align:center">
              © MarchéLink — Côte d'Ivoire
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
  }
}
