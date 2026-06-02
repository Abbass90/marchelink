import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterBuyerSchema, RegisterWholesalerSchema, LoginSchema, UpdateProfileSchema, ChangePasswordSchema } from './auth.schema.js';
import { ValidationError } from '../../errors/index.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE !== 'false',
  sameSite: 'strict' as const,
  path: '/',
};

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = RegisterBuyerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const result = await this.service.register(parsed.data);
      res.status(201).json({ id: result.userId });
    } catch (err) {
      next(err);
    }
  };

  registerWholesaler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = RegisterWholesalerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const result = await this.service.registerWholesaler(parsed.data);
      res.status(201).json({ id: result.userId, organization_id: result.organizationId });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const tokens = await this.service.login(parsed.data);

      const accessTtl = Number(process.env.JWT_ACCESS_TTL_SEC ?? 900);
      const refreshTtl = Number(process.env.JWT_REFRESH_TTL_SEC ?? 604800);

      res.cookie('access_token', tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: accessTtl * 1000,
      });
      res.cookie('refresh_token', tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: refreshTtl * 1000,
        path: '/api/auth',
      });

      res.json({ message: 'Logged in' });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentToken = req.cookies?.refresh_token as string | undefined;
      if (!currentToken) {
        throw new ValidationError('Missing refresh token');
      }

      const tokens = await this.service.refresh(currentToken);

      const accessTtl = Number(process.env.JWT_ACCESS_TTL_SEC ?? 900);
      const refreshTtl = Number(process.env.JWT_REFRESH_TTL_SEC ?? 604800);

      res.cookie('access_token', tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: accessTtl * 1000,
      });
      res.cookie('refresh_token', tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: refreshTtl * 1000,
        path: '/api/auth',
      });

      res.json({ message: 'Token refreshed' });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          status: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.correlationId,
        });
        return;
      }

      const user = await this.service.getProfile(userId);
      res.json(user);
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          status: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.correlationId,
        });
        return;
      }

      const parsed = UpdateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      const updated = await this.service.updateProfile(userId, parsed.data);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          status: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.correlationId,
        });
        return;
      }

      const parsed = ChangePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
      }

      await this.service.changePassword(userId, parsed.data);
      res.json({ message: 'Password updated' });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refresh_token as string | undefined;
      await this.service.logout(refreshToken);

      res.clearCookie('access_token', COOKIE_OPTIONS);
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, path: '/api/auth' });

      res.json({ message: 'Logged out' });
    } catch (err) {
      next(err);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.query.token as string | undefined;
      if (!token || typeof token !== 'string' || token.trim() === '') {
        res.status(422).json({
          status: 422,
          error: 'UNPROCESSABLE_ENTITY',
          message: 'Token de vérification manquant',
          requestId: req.correlationId,
        });
        return;
      }

      await this.service.verifyEmail(token);
      res.json({ message: 'Adresse email confirmée. Vous pouvez maintenant vous connecter.' });
    } catch (err) {
      next(err);
    }
  };
}
