import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Hand,
  MessageSquare,
  Users,
  Sparkles,
  Circle,
  PhoneOff,
  LayoutGrid,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const PARTICIPANTS = [
  { name: 'Aria Rivera', initials: 'AR', muted: false, speaking: true, grad: 'from-indigo-500 to-cyan-500' },
  { name: 'Marcus Lee', initials: 'ML', muted: true, speaking: false, grad: 'from-fuchsia-500 to-indigo-500' },
  { name: 'Priya Shah', initials: 'PS', muted: false, speaking: false, grad: 'from-emerald-500 to-teal-500' },
  { name: 'You', initials: 'YO', muted: false, speaking: false, grad: 'from-amber-500 to-rose-500', self: true },
];

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
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-2xl transition active:scale-95',
          danger
            ? 'bg-red-500 text-white hover:bg-red-600'
            : active
              ? 'bg-brand-gradient text-white'
              : 'bg-white/10 text-white hover:bg-white/20',
        )}
      >
        {icon}
      </span>
      <span className="text-[11px] text-white/60">{label}</span>
    </button>
  );
}

export function VideoCallPage() {
  const navigate = useNavigate();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [speakerView, setSpeakerView] = useState(false);

  return (
    <div className="flex h-full flex-col bg-[#0b1120] text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold">
            Design Sync
            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> REC
            </span>
          </h1>
          <p className="text-xs text-white/50">12:04 · 4 participants</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-medium shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> AI Summary
          </button>
          <button
            onClick={() => setSpeakerView((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Toggle layout"
          >
            {speakerView ? <LayoutGrid className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="min-h-0 flex-1 px-5">
        {speakerView ? (
          <div className="flex h-full flex-col gap-3">
            <Tile p={PARTICIPANTS[0]} big />
            <div className="flex gap-3 overflow-x-auto pb-1">
              {PARTICIPANTS.slice(1).map((p) => (
                <div key={p.name} className="h-24 w-40 shrink-0">
                  <Tile p={p} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid h-full grid-cols-2 gap-3 pb-2">
            {PARTICIPANTS.map((p) => (
              <Tile key={p.name} p={p} />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-5 py-5">
        <Control
          icon={micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          label="Mic"
          active={micOn}
          onClick={() => setMicOn((m) => !m)}
        />
        <Control
          icon={camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          label="Camera"
          active={camOn}
          onClick={() => setCamOn((c) => !c)}
        />
        <Control icon={<MonitorUp className="h-5 w-5" />} label="Share" />
        <Control icon={<Hand className="h-5 w-5" />} label="Raise" />
        <Control icon={<MessageSquare className="h-5 w-5" />} label="Chat" />
        <Control icon={<Users className="h-5 w-5" />} label="People" />
        <Control icon={<Circle className="h-5 w-5" />} label="Record" />
        <Control
          icon={<PhoneOff className="h-5 w-5" />}
          label="Leave"
          danger
          onClick={() => navigate(-1)}
        />
      </div>
    </div>
  );
}

function Tile({ p, big }: { p: (typeof PARTICIPANTS)[number]; big?: boolean }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-panel bg-[#111827] ring-1 transition',
        p.speaking ? 'ring-2 ring-cyan-400' : 'ring-white/10',
        big ? 'h-full w-full' : 'h-full w-full',
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className={cn('h-full w-full bg-gradient-to-br', p.grad)} />
      </div>
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full bg-gradient-to-br font-bold text-white shadow-lg',
          p.grad,
          big ? 'h-28 w-28 text-4xl' : 'h-16 w-16 text-xl',
        )}
      >
        {p.initials}
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1 text-xs backdrop-blur">
        {p.muted ? <MicOff className="h-3.5 w-3.5 text-red-400" /> : <Mic className="h-3.5 w-3.5 text-emerald-400" />}
        {p.name}
      </div>
      {p.self && (
        <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] backdrop-blur">
          You
        </span>
      )}
    </div>
  );
}
