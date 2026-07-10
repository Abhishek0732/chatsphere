import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { requestByQr } from '@/api/contacts';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { toast } from '@/store/toastStore';
import { apiErrorMessage } from '@/utils/apiError';
import { Spinner } from '@/components/ui/Spinner';
import { Logo } from '@/components/ui/Logo';

/** sessionStorage key used to resume a QR add after logging in. */
export const PENDING_QR_KEY = 'pendingQrToken';

/**
 * Landing page for a scanned QR deep link ({@code /add?token=…}). If signed in,
 * it sends the contact invitation immediately; if not, it stashes the token and
 * routes to login, which resumes here afterwards.
 */
export function AddByQrPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const ran = useRef(false);
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('Connecting…');

  useEffect(() => {
    if (!hydrated || ran.current) return;

    if (!token) {
      ran.current = true;
      setState('error');
      setMessage('This link is missing its code.');
      return;
    }
    if (!accessToken) {
      // Not signed in — remember the token and continue after auth.
      sessionStorage.setItem(PENDING_QR_KEY, token);
      navigate('/login', { replace: true });
      return;
    }

    ran.current = true;
    requestByQr(token)
      .then((res) => {
        if (res.status === 'ACCEPTED') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
          void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
          toast({ title: 'Contact added', variant: 'success' });
          setMessage('You are now connected.');
        } else {
          void queryClient.invalidateQueries({ queryKey: queryKeys.contactRequestsOutgoing });
          toast({ title: 'Invitation sent', description: 'They need to accept it.', variant: 'success' });
          setMessage('Invitation sent. They need to accept it.');
        }
        setState('done');
        setTimeout(() => navigate('/', { replace: true }), 1400);
      })
      .catch((err) => {
        setState('error');
        setMessage(apiErrorMessage(err, 'This QR code is invalid or expired.'));
      });
  }, [hydrated, accessToken, token, navigate]);

  return (
    <div className="flex min-h-full items-center justify-center bg-surface p-6 text-on-surface">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <Logo className="h-16 w-16 shadow-lg ring-1 ring-white/10" />
        {state === 'working' && <Spinner className="h-7 w-7" />}
        {state === 'done' && <CheckCircle2 className="h-12 w-12 text-primary" />}
        {state === 'error' && <XCircle className="h-12 w-12 text-error" />}
        <p className="text-base text-on-surface-variant">{message}</p>
        {state === 'error' && (
          <button
            onClick={() => navigate('/', { replace: true })}
            className="glow-button rounded-xl bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary-container"
          >
            Go to ChatSphere
          </button>
        )}
      </div>
    </div>
  );
}
