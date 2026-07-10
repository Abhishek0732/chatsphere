import axios from 'axios';
import { api, API_BASE_URL } from './client';
import type { AuthResponse, LoginPayload, RegisterPayload } from '@/types';

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

/** Signup step 1: email a verification code to the address. */
export async function sendRegisterOtp(email: string): Promise<void> {
  await api.post('/auth/register/send-otp', { email });
}

/** Signup step 2: confirm the emailed code. */
export async function verifyRegisterOtp(email: string, code: string): Promise<void> {
  await api.post('/auth/register/verify-otp', { email, code });
}

/** Email a password-reset link (always succeeds — never reveals if the email exists). */
export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

/** Set a new password using the emailed reset token. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { token, newPassword });
}

/** Change the current user's password (must supply the current one). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/account/password', { currentPassword, newPassword });
}

export async function logout(refreshToken: string): Promise<void> {
  // Use a bare client so a possibly-expired access token doesn't trigger the
  // refresh interceptor during teardown.
  await axios.post(
    `${API_BASE_URL}/auth/logout`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );
}
