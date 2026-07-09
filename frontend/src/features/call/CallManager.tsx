import { useEffect } from 'react';
import { useCallStore } from '@/store/callStore';
import { getActiveCall, registerDevice } from '@/api/calls';
import { startRingtone, stopRingtone } from './ringtone';
import { mediaService } from './mediaService';
import { IncomingCallModal } from './IncomingCallModal';
import { CallScreen } from './CallScreen';
import type { ActiveCallDto } from '@/types';

/** Map a resumed active-call DTO to on-screen call state (this user's perspective). */
function fromDto(dto: ActiveCallDto): void {
  const outgoing = dto.outgoing;
  const peer = outgoing
    ? { id: dto.calleeId, name: dto.calleeName ?? 'Unknown', avatarUrl: dto.calleeAvatarUrl }
    : { id: dto.callerId, name: dto.callerName ?? 'Unknown', avatarUrl: dto.callerAvatarUrl };
  const phase =
    dto.status === 'ACTIVE' ? 'active' : outgoing ? 'outgoing' : 'incoming';
  useCallStore.getState().setCall({
    callId: dto.callId,
    type: dto.type,
    phase,
    outgoing,
    peer,
    answeredAt: dto.answeredAt ? new Date(dto.answeredAt).getTime() : undefined,
  });
}

/**
 * Global call orchestrator: registers this device, resumes any in-progress call
 * after a reload, drives the ringtone off the call phase, auto-dismisses the
 * ended screen, and renders the incoming / active overlays. Mounted once in the
 * authenticated shell.
 */
export function CallManager() {
  const call = useCallStore((s) => s.call);
  const phase = call?.phase;
  const callId = call?.callId;

  // Register device + resume a live call once, on mount.
  useEffect(() => {
    void registerDevice().catch(() => {});
    void getActiveCall()
      .then((dto) => {
        if (dto && !useCallStore.getState().call) fromDto(dto);
      })
      .catch(() => {});
  }, []);

  // Ringtone follows the phase.
  useEffect(() => {
    if (phase === 'incoming') startRingtone('incoming');
    else if (phase === 'outgoing') startRingtone('outgoing');
    else stopRingtone();
    return () => stopRingtone();
  }, [phase, callId]);

  // Media plane: open the peer-to-peer connection once active; tear down otherwise.
  useEffect(() => {
    if (phase === 'active' && callId) void mediaService.start(callId);
    else mediaService.leave();
  }, [phase, callId]);

  // Auto-dismiss the ended screen after a beat.
  useEffect(() => {
    if (phase !== 'ended') return;
    const t = setTimeout(() => useCallStore.getState().clear(), 2500);
    return () => clearTimeout(t);
  }, [phase, callId]);

  if (!call) return null;
  return call.phase === 'incoming' ? <IncomingCallModal /> : <CallScreen />;
}
