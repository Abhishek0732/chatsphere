import { useEffect, useRef, useState } from 'react';
import * as QRCode from 'qrcode';
import { ShieldCheck, ShieldAlert, ScanLine, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getPeerKey } from '@/api/keys';
import { getMyPublicKey } from '@/services/e2ee';
import { safetyNumber, formatSafetyNumber } from '@/services/crypto';
import { useVerifiedStore } from '@/store/verifiedStore';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

/** QR payload prefix so a safety-number code is never confused with a contact link. */
const QR_PREFIX = 'csn:';

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

export function SafetyNumberModal({
  open,
  onClose,
  peerId,
  peerName,
}: {
  open: boolean;
  onClose: () => void;
  peerId: number;
  peerName: string;
}) {
  const [number, setNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataUrl, setDataUrl] = useState('');
  const [scanning, setScanning] = useState(false);

  const verified = useVerifiedStore((s) => (number ? s.verified[peerId] === number : false));
  const markVerified = useVerifiedStore((s) => s.markVerified);
  const clearVerified = useVerifiedStore((s) => s.clearVerified);

  // Compute the safety number from BOTH identity keys whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    setNumber(null);
    setDataUrl('');
    setScanning(false);
    void (async () => {
      try {
        const mine = getMyPublicKey();
        const peer = await getPeerKey(peerId);
        const n = await safetyNumber(mine, peer.publicKey);
        if (!live) return;
        setNumber(n);
        if (n) {
          QRCode.toDataURL(QR_PREFIX + n, { width: 256, margin: 1 })
            .then((u) => live && setDataUrl(u))
            .catch(() => live && setDataUrl(''));
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [open, peerId]);

  const onScanResult = (raw: string) => {
    const scanned = raw.startsWith(QR_PREFIX) ? raw.slice(QR_PREFIX.length) : raw;
    if (number && scanned.replace(/\s/g, '') === number) {
      markVerified(peerId, number);
      setScanning(false);
      toast({ title: `${peerName} is verified`, variant: 'success' });
    } else {
      setScanning(false);
      toast({
        title: 'Codes do not match',
        description: 'This may be a different contact — or someone in the middle.',
        variant: 'error',
      });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Verify security code">
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner className="h-6 w-6 text-on-surface-variant" />
        </div>
      ) : !number ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">
          {peerName} hasn't set up encryption yet, so there's no code to compare.
        </p>
      ) : scanning ? (
        <ScanView onResult={onScanResult} onCancel={() => setScanning(false)} />
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium',
              verified
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-amber-500/15 text-amber-500',
            )}
          >
            {verified ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            {verified ? 'Verified' : 'Not verified'}
          </div>

          <div className="flex h-56 w-56 items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
            {dataUrl ? (
              <img src={dataUrl} alt="Your security code" className="h-full w-full" />
            ) : (
              <Spinner className="h-6 w-6 text-slate-400" />
            )}
          </div>

          <p className="select-all break-words font-mono text-sm tracking-wide text-on-surface">
            {formatSafetyNumber(number)}
          </p>
          <p className="text-xs text-on-surface-variant">
            You and {peerName} see the same code when no one is in the middle. Compare it in
            person or over a call, or scan each other's code.
          </p>

          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-container transition hover:brightness-110"
            >
              <ScanLine className="h-4 w-4" /> Scan {peerName}'s code
            </button>
            {verified ? (
              <button
                type="button"
                onClick={() => clearVerified(peerId)}
                className="rounded-full px-4 py-2 text-sm font-medium text-error transition hover:bg-error/10"
              >
                Clear verification
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  markVerified(peerId, number);
                  toast({ title: `Marked ${peerName} as verified`, variant: 'success' });
                }}
                className="rounded-full px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-white/5"
              >
                Mark as verified
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ScanView({ onResult, onCancel }: { onResult: (raw: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [manual, setManual] = useState('');
  const handledRef = useRef(false);

  useEffect(() => {
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

    const tick = async () => {
      if (stopped || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes[0]?.rawValue && !handledRef.current) {
          handledRef.current = true;
          onResult(codes[0].rawValue);
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
      .catch(() => setError('Camera access was denied. Allow it, or paste their code below.'));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {!unsupported && (
        <div className="relative h-56 w-56 overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70" />
        </div>
      )}
      {error && <p className="text-center text-sm text-error">{error}</p>}
      {(unsupported || error) && (
        <div className="w-full space-y-2">
          {unsupported && (
            <p className="text-center text-sm text-on-surface-variant">
              Scanning isn't supported here. Paste their code instead.
            </p>
          )}
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Paste their security code"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => manual.trim() && onResult(manual.trim())}
              disabled={!manual.trim()}
              className="rounded-xl bg-primary-container px-4 text-sm font-semibold text-on-primary-container disabled:opacity-60"
            >
              Check
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-white/5"
      >
        <X className="h-4 w-4" /> Cancel
      </button>
    </div>
  );
}
