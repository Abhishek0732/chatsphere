import { z } from 'zod';

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    displayName: z.string().min(2, 'Enter your name'),
    username: z
      .string()
      .min(3, 'At least 3 characters')
      .regex(/^[a-zA-Z0-9_.]+$/, 'Letters, numbers, _ and . only'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(6, 'At least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

// Signup step 1 — account details (email is verified via OTP before the password).
export const registerDetailsSchema = z.object({
  displayName: z.string().min(2, 'Enter your name'),
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .regex(/^[a-zA-Z0-9_.]+$/, 'Letters, numbers, _ and . only'),
  email: z.string().email('Enter a valid email'),
});
export type RegisterDetailsValues = z.infer<typeof registerDetailsSchema>;

// Signup step 3 — choose a password (after the email is verified).
export const registerPasswordSchema = z
  .object({
    password: z.string().min(6, 'At least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterPasswordValues = z.infer<typeof registerPasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'At least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(6, 'At least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Choose a different password',
    path: ['newPassword'],
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
