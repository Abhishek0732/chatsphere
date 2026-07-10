import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as QRCode from 'qrcode';
import { RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getMyQr, rotateMyQr } from '@/api/users';
import { requestByQr } from '@/api/contacts';
import { queryKeys } from '@/api/queryKeys';
import { toast } from '@/store/toastStore';
import { apiErrorMessage } from '@/utils/apiError';
import { useResetOnClose } from '@/hooks/useResetOnClose';
import { cn } from '@/utils/cn';
import type { SendRequestResult } from '@/types';

// BarcodeDetector is native in Chromium/Android; typings aren't in the DOM lib.
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
function makeDetector(): BarcodeDetectorLike | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

export function QrModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'code' | 'scan'>('code');
  // Reopening starts on "My code"; this also unmounts Scan, clearing its input.
  useResetOnClose(open, () => setTab('code'));

  return (
    <Modal open={open} onClose={onClose} title="QR code">
      <div className="mb-4 flex gap-1 rounded-xl bg-white/5 p-1">
        {(['code', 'scan'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-sm font-medium transition',
              tab === k ? 'bg-white/10 text-on-surface' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {k === 'code' ? 'My code' : 'Scan'}
          </button>
        ))}
      </div>
      {tab === 'code' ? <MyCode open={open} /> : <Scan open={open} active={tab === 'scan'} onClose={onClose} />}
    </Modal>
  );
}

function MyCode({ open }: { open: boolean }) {
  const qc = useQueryClient();
  const [dataUrl, setDataUrl] = useState('');
  const { data: qr, isLoading } = useQuery({
    queryKey: ['myQr'],
    queryFn: getMyQr,
    enabled: open,
  });

  useEffect(() => {
    if (!qr?.token) return;
    // Encode a deep link built from the CURRENT origin, so the QR works on
    // whatever URL the app is being served from (localhost, LAN IP, tunnel).
    // Any camera opens it; the in-app scanner also understands it.
    const url = `${window.location.origin}/add?token=${encodeURIComponent(qr.token)}`;
    QRCode.toDataURL(url, { width: 256, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(''));
  }, [qr?.token]);

  const rotate = useMutation({
    mutationFn: rotateMyQr,
    onSuccess: (fresh) => {
      qc.setQueryData(['myQr'], fresh);
      toast({ title: 'QR code reset', description: 'Your old code no longer works.', variant: 'success' });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, 'Could not reset code'), variant: 'error' }),
  });

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-on-surface-variant">
        Let someone scan this to send you a contact request.
      </p>
      <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
        {isLoading || !dataUrl ? (
          <Spinner className="h-6 w-6 text-slate-400" />
        ) : (
          <img src={dataUrl} alt="Your QR code" className="h-full w-full" />
        )}
      </div>
      <button
        type="button"
        onClick={() => rotate.mutate()}
        disabled={rotate.isPending}
        className="inline-flex items-center gap-2 rounded-full glass-panel px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-white/5 disabled:opacity-60"
      >
        <RefreshCw className={cn('h-4 w-4', rotate.isPending && 'animate-spin')} /> Reset my code
      </button>
      <p className="text-xs text-on-surface-variant">
        Reset if you've shared your code publicly — it invalidates the old one.
      </p>
    </div>
  );
}

function Scan({ open, active, onClose }: { open: boolean; active: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [manual, setManual] = useState('');
  const handledRef = useRef(false);

  const add = useMutation({
    mutationFn: (code: string) => requestByQr(code),
    onSuccess: (result: SendRequestResult) => {
      if (result.status === 'ACCEPTED') {
        // They had already invited me → we became contacts immediately.
        qc.invalidateQueries({ queryKey: queryKeys.contacts });
        qc.invalidateQueries({ queryKey: queryKeys.conversations });
        toast({ title: 'Contact added', variant: 'success' });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.contactRequestsOutgoing });
        toast({ title: 'Invitation sent', description: 'They need to accept it.', variant: 'success' });
      }
      onClose();
    },
    onError: (err) => {
      handledRef.current = false; // allow another scan after a failure
      toast({ title: apiErrorMessage(err, 'Could not send invitation'), variant: 'error' });
    },
  });

  useEffect(() => {
    if (!open || !active) return;
    handledRef.current = false;
    setError(null);
    const detector = makeDetector();
    if (!detector) {
      setUnsupported(true);
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    const onHit = (raw: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      add.mutate(raw);
    };

    const tick = async () => {
      if (stopped || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes[0]?.rawValue) {
          onHit(codes[0].rawValue);
          return;
        }
      } catch {
        /* transient decode errors are fine — keep scanning */
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setError('Camera access was denied. Allow it, or paste a code below.'));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  return (
    <div className="flex flex-col items-center gap-4">
      {!unsupported && (
        <div className="relative h-64 w-64 overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70" />
        </div>
      )}
      {error && <p className="text-center text-sm text-error">{error}</p>}
      {!unsupported && !error && (
        <p className="text-center text-sm text-on-surface-variant">Point the camera at a ChatSphere QR code.</p>
      )}

      {(unsupported || error) && (
        <div className="w-full space-y-2">
          {unsupported && (
            <p className="text-center text-sm text-on-surface-variant">
              Scanning isn't supported on this browser. Paste the code or link instead.
            </p>
          )}
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Paste QR code or link"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => manual.trim() && add.mutate(manual.trim())}
              disabled={add.isPending || !manual.trim()}
              className="rounded-xl bg-primary-container px-4 text-sm font-semibold text-on-primary-container disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </div>
      )}
      {add.isPending && <Spinner className="h-5 w-5" />}
    </div>
  );
}
