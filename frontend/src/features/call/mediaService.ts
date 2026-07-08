import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from 'livekit-client';
import { getCallToken } from '@/api/calls';
import { useCallStore } from '@/store/callStore';
import type { IceServer } from '@/types';

/**
 * The media plane. Once a call is ACTIVE, joins the LiveKit room, publishes the
 * mic (with echo cancellation + noise suppression), and plays the remote audio.
 * Signaling to the SFU is same-origin (proxied at /rtc), so it follows whatever
 * URL the app is served on — localhost, LAN, or a public tunnel — never a
 * baked-in host.
 */
class MediaService {
  private room: Room | null = null;
  private joiningCallId: string | null = null;
  private audioEls: HTMLAudioElement[] = [];

  /**
   * Resolve the LiveKit ws URL. An absolute ws(s):// from the backend (e.g. an
   * external LiveKit Cloud) wins; otherwise use the current origin so the SFU is
   * reached same-origin through the nginx /rtc proxy.
   */
  private resolveUrl(configured: string): string {
    if (configured && /^wss?:\/\//i.test(configured)) return configured;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }

  private toRtcIce(servers: IceServer[]): RTCIceServer[] {
    return servers.map((s) => {
      const ice: RTCIceServer = { urls: s.urls };
      if (s.username) ice.username = s.username;
      if (s.credential) ice.credential = s.credential;
      return ice;
    });
  }

  async join(callId: string): Promise<void> {
    if (this.room || this.joiningCallId === callId) return;
    this.joiningCallId = callId;
    try {
      const info = await getCallToken(callId);
      // The call may have ended while we were fetching the token.
      const current = useCallStore.getState().call;
      if (!current || current.callId !== callId || current.phase === 'ended') {
        this.joiningCallId = null;
        return;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.room = room;

      room.on(RoomEvent.TrackSubscribed, (track) => this.attach(track));
      room.on(RoomEvent.TrackUnsubscribed, (track) => this.detach(track));
      room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (participant?.isLocal) {
          useCallStore.getState().patchCall({ quality: this.mapQuality(quality) });
        }
      });

      await room.connect(this.resolveUrl(info.url), info.token, {
        rtcConfig: { iceServers: this.toRtcIce(info.iceServers) },
      });
      await room.localParticipant.setMicrophoneEnabled(!useCallStore.getState().muted);

      // Debug/test hook: lets a probe read the remote streams to prove audio flow.
      (window as unknown as { __lkRoom?: Room }).__lkRoom = room;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[media] join failed', err);
    } finally {
      this.joiningCallId = null;
    }
  }

  async setMuted(muted: boolean): Promise<void> {
    if (this.room) await this.room.localParticipant.setMicrophoneEnabled(!muted);
  }

  leave(): void {
    this.audioEls.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    this.audioEls = [];
    if (this.room) {
      void this.room.disconnect();
      this.room = null;
    }
    const w = window as unknown as { __lkRoom?: Room; __lkRemoteStreams?: MediaStream[] };
    w.__lkRoom = undefined;
    w.__lkRemoteStreams = [];
  }

  private attach(track: RemoteTrack): void {
    if (track.kind !== Track.Kind.Audio) return;
    const el = track.attach();
    el.autoplay = true;
    (el as HTMLMediaElement).setAttribute('playsinline', 'true');
    el.style.display = 'none';
    document.body.appendChild(el);
    this.audioEls.push(el as HTMLAudioElement);

    // Test hook: expose the remote stream so a probe can measure audio energy.
    const w = window as unknown as { __lkRemoteStreams?: MediaStream[] };
    w.__lkRemoteStreams = w.__lkRemoteStreams ?? [];
    if (track.mediaStreamTrack) {
      w.__lkRemoteStreams.push(new MediaStream([track.mediaStreamTrack]));
    }
  }

  private detach(track: RemoteTrack): void {
    track.detach().forEach((el) => el.remove());
  }

  private mapQuality(q: ConnectionQuality): string {
    switch (q) {
      case ConnectionQuality.Excellent:
        return 'excellent';
      case ConnectionQuality.Good:
        return 'good';
      case ConnectionQuality.Poor:
        return 'poor';
      case ConnectionQuality.Lost:
        return 'lost';
      default:
        return 'good';
    }
  }
}

export const mediaService = new MediaService();
