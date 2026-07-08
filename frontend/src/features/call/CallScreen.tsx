import { useEffect, useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useCallStore } from '@/store/callStore';
import { socketService } from '@/services/socket';
import { mediaService } from './mediaService';
import { cn } from '@/utils/cn';

const QUALITY_LABEL: Record<string, { text: string; color: string }> = {
  excellent: { text: 'Excellent connection', color: 'bg-green-400' },
  good: { text: 'Good connection', color: 'bg-green-400' },
  poor: { text: 'Weak connection', color: 'bg-amber-400' },
  lost: { text: 'Connection lost', color: 'bg-red-400' },
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Full-screen outgoing / active / ended call surface, mounted globally. */
export function CallScreen() {
  const call = useCallStore((s) => s.call);
  const muted = useCallStore((s) => s.muted);
  const speaker = useCallStore((s) => s.speaker);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleSpeaker = useCallStore((s) => s.toggleSpeaker);
  const [elapsed, setElapsed] = useState(0);

  const answeredAt = call?.answeredAt;
  useEffect(() => {
    if (call?.phase !== 'active' || !answeredAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - answeredAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [call?.phase, answeredAt]);

  // Keep the published mic in sync with the mute toggle.
  useEffect(() => {
    void mediaService.setMuted(muted);
  }, [muted]);

  if (!call) return null;

  const status =
    call.phase === 'outgoing'
      ? 'Ringing…'
      : call.phase === 'active'
        ? formatDuration(elapsed)
        : (call.endedLabel ?? 'Call ended');

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 to-slate-950 p-8 text-white">
      <div className="mt-20 flex flex-col items-center gap-4 text-center">
        <Avatar
          name={call.peer.name}
          src={call.peer.avatarUrl}
          size="xl"
          className="ring-4 ring-white/15"
        />
        <h2 className="text-2xl font-semibold tracking-tight">{call.peer.name}</h2>
        <p className="tabular-nums text-white/70">{status}</p>
        {call.phase === 'active' && call.quality && QUALITY_LABEL[call.quality] && (
          <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            <span className={cn('h-2 w-2 rounded-full', QUALITY_LABEL[call.quality].color)} />
            {QUALITY_LABEL[call.quality].text}
          </span>
        )}
      </div>

      <div className="mb-10 flex items-center gap-5">
        {call.phase !== 'ended' && (
          <>
            <button
              onClick={toggleMute}
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full transition',
                muted ? 'bg-white text-slate-900' : 'bg-white/10 hover:bg-white/20',
              )}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <button
              onClick={() => socketService.hangUp()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg transition hover:bg-red-600"
              aria-label="End call"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              onClick={toggleSpeaker}
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full transition',
                speaker ? 'bg-white text-slate-900' : 'bg-white/10 hover:bg-white/20',
              )}
              aria-label="Speaker"
            >
              <Volume2 className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
