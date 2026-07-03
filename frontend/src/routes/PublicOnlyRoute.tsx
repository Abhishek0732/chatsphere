import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { FullPageSpinner } from '@/components/ui/Spinner';

/** Redirect already-authenticated users away from login/register. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!hydrated) return <FullPageSpinner />;
  if (accessToken) return <Navigate to="/" replace />;

  return <>{children}</>;
}
