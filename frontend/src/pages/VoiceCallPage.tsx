import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Volume2,
  Bluetooth,
  Circle,
  Video,
  UserPlus,
  PhoneOff,
  SignalHigh,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/utils/cn';

function Control({
  icon,
  label,
  active,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <span
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-xl transition active:scale-95',
          danger
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600'
            : active
              ? 'bg-white text-slate-900'
              : 'bg-white/10 text-white hover:bg-white/20',
        )}
      >
        {icon}
      </span>
      <span className="text-xs text-white/70">{label}</span>
    </button>
  );
}

export function VoiceCallPage() {
  const navigate = useNavigate();
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);

  return (
    <div className="relative flex h-full flex-col items-center justify-between overflow-hidden bg-[#0b1220] p-8 text-white">
      {/* Ambient blurred backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-gradient opacity-30 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-brand-500/15 blur-[100px]" />
      </div>

      {/* Top status */}
      <div className="relative z-10 flex flex-col items-center gap-2 pt-6">
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Recording
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/60">
          <SignalHigh className="h-4 w-4 text-emerald-400" /> Excellent connection
        </span>
      </div>

      {/* Avatar with pulse rings */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <span className="absolute h-44 w-44 rounded-full bg-brand-gradient opacity-40 animate-ring-pulse" />
          <span
            className="absolute h-44 w-44 rounded-full bg-brand-gradient opacity-40 animate-ring-pulse"
            style={{ animationDelay: '1.2s' }}
          />
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-brand-gradient text-5xl font-bold shadow-2xl">
            AR
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Aria Rivera</h1>
          <p className="mt-1 text-sm text-white/60">Voice call</p>
        </div>

        {/* Live equalizer + timer */}
        <div className="flex items-center gap-4">
          <div className="flex h-6 items-end gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-brand-gradient animate-equalize"
                style={{ height: '100%', animationDelay: `${i * 0.09}s` }}
              />
            ))}
          </div>
          <span className="font-mono text-lg tabular-nums text-white/90">12:04</span>
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 w-full max-w-md pb-4">
        <div className="mb-6 grid grid-cols-4 gap-4">
          <Control
            icon={muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            label={muted ? 'Unmute' : 'Mute'}
            active={muted}
            onClick={() => setMuted((m) => !m)}
          />
          <Control
            icon={<Volume2 className="h-6 w-6" />}
            label="Speaker"
            active={speaker}
            onClick={() => setSpeaker((s) => !s)}
          />
          <Control icon={<Bluetooth className="h-6 w-6" />} label="Bluetooth" />
          <Control icon={<Circle className="h-6 w-6" />} label="Record" />
        </div>
        <div className="grid grid-cols-3 items-center gap-4">
          <Control icon={<UserPlus className="h-6 w-6" />} label="Add" />
          <Control
            icon={<PhoneOff className="h-7 w-7" />}
            label="End"
            danger
            onClick={() => navigate(-1)}
          />
          <Control
            icon={<Video className="h-6 w-6" />}
            label="Video"
            onClick={() => navigate('/call/video')}
          />
        </div>
      </div>
    </div>
  );
}
