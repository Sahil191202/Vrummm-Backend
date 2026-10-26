import { z } from 'zod';
import { ROLES } from '../../rbac/permissions.js';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters'); // bcrypt truncates at 72

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+\d{10,15}$/, 'Phone must be in E.164 format e.g. +919876543210')
    .optional(),
  // Only admins can set roles other than CUSTOMER. Enforced in the controller.
  role: z.enum(Object.values(ROLES)).optional().default(ROLES.CUSTOMER),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
