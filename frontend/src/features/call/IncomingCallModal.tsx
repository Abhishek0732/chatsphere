import { Phone, PhoneOff } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useCallStore } from '@/store/callStore';
import { socketService } from '@/services/socket';

/** Full-screen incoming-call prompt (WhatsApp-style), mounted globally. */
export function IncomingCallModal() {
  const call = useCallStore((s) => s.call);
  if (!call) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-slate-950/95 p-8 text-white backdrop-blur-md">
      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">
          Incoming voice call
        </span>
        <Avatar
          name={call.peer.name}
          src={call.peer.avatarUrl}
          size="xl"
          className="animate-pulse ring-4 ring-white/20"
        />
        <h2 className="text-2xl font-semibold tracking-tight">{call.peer.name}</h2>
      </div>

      <div className="mb-10 flex w-full max-w-xs items-center justify-between">
        <button
          onClick={() => socketService.declineCall()}
          className="flex flex-col items-center gap-2"
          aria-label="Decline"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg transition hover:bg-red-600">
            <PhoneOff className="h-7 w-7" />
          </span>
          <span className="text-sm text-white/80">Decline</span>
        </button>
        <button
          onClick={() => socketService.answerCall()}
          className="flex flex-col items-center gap-2"
          aria-label="Accept"
        >
          <span className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-green-500 shadow-lg transition hover:bg-green-600">
            <Phone className="h-7 w-7" />
          </span>
          <span className="text-sm text-white/80">Accept</span>
        </button>
      </div>
    </div>
  );
}
