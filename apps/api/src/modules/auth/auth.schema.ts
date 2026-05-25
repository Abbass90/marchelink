import { z } from 'zod';

export const RegisterBuyerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
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
  phone: z.string().max(20).optional(),
  organization_name: z.string().min(1).max(255),
});

export type RegisterWholesalerInput = z.infer<typeof RegisterWholesalerSchema>;

export const UpdateProfileSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(20).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z.object({
  old_password: z.string().min(1).max(128),
  new_password: z.string().min(8).max(128),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
