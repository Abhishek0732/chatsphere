import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { authAccessors } from '@/store/authStore';
import type { RefreshResponse } from '@/types';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// --- Attach the access token to every request -----------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authAccessors.getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// --- Refresh-on-401 with single-flight de-duplication ----------------------
interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

/** Callbacks invoked after a successful refresh (e.g. reconnect the socket). */
type RefreshListener = (accessToken: string) => void;
const refreshListeners = new Set<RefreshListener>();
export function onTokenRefreshed(listener: RefreshListener): () => void {
  refreshListeners.add(listener);
  return () => refreshListeners.delete(listener);
}

/** Callback for hard logout (refresh failed). */
type LogoutListener = () => void;
const logoutListeners = new Set<LogoutListener>();
export function onForcedLogout(listener: LogoutListener): () => void {
  logoutListeners.add(listener);
  return () => logoutListeners.delete(listener);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authAccessors.getRefreshToken();
  if (!refreshToken) return null;

  try {
    // Bare axios instance so we don't recurse through this interceptor.
    const { data } = await axios.post<RefreshResponse>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    );
    authAccessors.setTokens(data.accessToken, data.refreshToken);
    refreshListeners.forEach((l) => l(data.accessToken));
    return data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (RetriableConfig & InternalAxiosRequestConfig) | undefined;
    const status = error.response?.status;

    const isAuthEndpoint =
      typeof original?.url === 'string' && original.url.includes('/auth/');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;

      if (newToken) {
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return api(original);
      }

      // Refresh failed -> force logout.
      authAccessors.logout();
      logoutListeners.forEach((l) => l());
    }

    return Promise.reject(error);
  },
);
