import { getIceServers } from '@/api/calls';
import { useCallStore } from '@/store/callStore';
import { socketService } from '@/services/socket';
import { toast } from '@/store/toastStore';
import type { CallSignal, IceServer } from '@/types';

/**
 * The media plane — native peer-to-peer WebRTC, no SFU, no external SDK.
 *
 * Once a call is ACTIVE, both browsers open an {@link RTCPeerConnection} and
 * negotiate directly: the CALLER creates the SDP offer, the CALLEE answers, and
 * both trickle ICE candidates. All of that is relayed as small JSON frames over
 * our existing STOMP socket (`/app/call.signal`) — the server never sees the
 * audio. The actual voice flows browser↔browser, falling back to a TURN relay
 * (from {@link getIceServers}) only when no direct path exists. That's what makes
 * it work identically on localhost, LAN, and a public tunnel.
 */
class MediaService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private callId: string | null = null;

  /** True once the remote SDP is set, so trickled ICE can be applied. */
  private remoteReady = false;
  /** ICE candidates that arrived before the remote description was set. */
  private pendingCandidates: RTCIceCandidateInit[] = [];
  /** In-flight setup, so a concurrent start()/offer can await the same one. */
  private startPromise: Promise<void> | null = null;

  private toRtcIce(servers: IceServer[]): RTCIceServer[] {
    return servers.map((s) => {
      const ice: RTCIceServer = { urls: s.urls };
      if (s.username) ice.username = s.username;
      if (s.credential) ice.credential = s.credential;
      return ice;
    });
  }

  /**
   * Bring up the peer connection for a call. Idempotent and safe to call from
   * both the "phase became active" effect and the first inbound offer — they
   * share one setup. The caller (outgoing) makes the offer; the callee waits.
   */
  start(callId: string): Promise<void> {
    if (this.pc && this.callId === callId) return Promise.resolve();
    if (this.startPromise && this.callId === callId) return this.startPromise;
    // A different call than the one we're set up for — reset first.
    if (this.callId && this.callId !== callId) this.teardown();

    this.callId = callId;
    this.startPromise = this.setup(callId).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[media] start failed', err);
    });
    return this.startPromise;
  }

  private async setup(callId: string): Promise<void> {
    const isCaller = !!useCallStore.getState().call?.outgoing;

    // 1. ICE servers (STUN + our Coturn + a public TURN relay).
    let iceServers: RTCIceServer[] = [];
    try {
      const cfg = await getIceServers();
      iceServers = this.toRtcIce(cfg.iceServers);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[media] ICE fetch failed — using default STUN', err);
      iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];
    }

    // The call may have ended while we were fetching.
    const cur = useCallStore.getState().call;
    if (!cur || cur.callId !== callId || cur.phase === 'ended') return;

    // 2. Microphone (with echo cancellation + noise suppression). Browsers only
    // expose the mic in a "secure context": https:// OR http://localhost. Over
    // plain http:// on a LAN IP, navigator.mediaDevices is undefined — surface a
    // clear reason instead of a silent dead call.
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: 'Microphone blocked on this URL',
        description:
          'Voice calls need a secure page. Open the app over the https tunnel URL, or http://localhost — a plain http:// IP address blocks mic access.',
        variant: 'error',
      });
      return;
    }
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[media] microphone unavailable', err);
      toast({
        title: 'Microphone unavailable',
        description: 'Allow microphone access in your browser to talk on calls.',
        variant: 'error',
      });
      return;
    }

    // 3. Peer connection. `window.__forceRelay = true` forces all media through
    // TURN — a handy way to prove the cross-network relay path works from a
    // single machine (it simulates two peers that can't reach each other directly).
    const config: RTCConfiguration = { iceServers };
    if ((window as unknown as { __forceRelay?: boolean }).__forceRelay) {
      config.iceTransportPolicy = 'relay';
    }
    const pc = new RTCPeerConnection(config);
    this.pc = pc;
    this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));
    this.applyMute(useCallStore.getState().muted);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socketService.sendRtcSignal(callId, 'ice', undefined, JSON.stringify(ev.candidate.toJSON()));
      }
    };
    pc.ontrack = (ev) => this.attachRemote(ev.streams[0] ?? new MediaStream([ev.track]));
    pc.onconnectionstatechange = () => this.onConnState(pc.connectionState);

    // Debug/test hook.
    (window as unknown as { __rtcPc?: RTCPeerConnection }).__rtcPc = pc;

    // 4. The caller opens negotiation with an offer.
    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketService.sendRtcSignal(callId, 'offer', offer.sdp);
    }
  }

  /** Handle an inbound WebRTC frame (offer / answer / ICE) from the peer. */
  async onSignal(signal: CallSignal): Promise<void> {
    const callId = signal.callId;
    if (!callId) return;

    // The offer can land right as we go active — make sure our side is up.
    if (!this.pc || this.callId !== callId) await this.start(callId);
    const pc = this.pc;
    if (!pc) return;

    try {
      if (signal.type === 'WEBRTC_OFFER' && signal.sdp) {
        await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        this.remoteReady = true;
        await this.flushCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketService.sendRtcSignal(callId, 'answer', answer.sdp);
      } else if (signal.type === 'WEBRTC_ANSWER' && signal.sdp) {
        await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        this.remoteReady = true;
        await this.flushCandidates();
      } else if (signal.type === 'WEBRTC_ICE' && signal.candidate) {
        const cand = JSON.parse(signal.candidate) as RTCIceCandidateInit;
        if (this.remoteReady) await pc.addIceCandidate(cand);
        else this.pendingCandidates.push(cand);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[media] failed handling', signal.type, err);
    }
  }

  private async flushCandidates(): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    const pending = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of pending) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* a stale candidate is harmless */
      }
    }
  }

  async setMuted(muted: boolean): Promise<void> {
    this.applyMute(muted);
  }

  private applyMute(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  leave(): void {
    this.teardown();
  }

  private attachRemote(stream: MediaStream): void {
    let el = this.audioEl;
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.setAttribute('playsinline', 'true');
      el.style.display = 'none';
      document.body.appendChild(el);
      this.audioEl = el;
    }
    el.srcObject = stream;
    void el.play().catch(() => {
      /* autoplay after the accept gesture is allowed; ignore benign rejections */
    });
    // Test hook: lets a probe measure remote audio energy.
    (window as unknown as { __rtcRemoteStream?: MediaStream }).__rtcRemoteStream = stream;
  }

  private onConnState(state: RTCPeerConnectionState): void {
    const quality =
      state === 'connected' || state === 'connecting' || state === 'new'
        ? 'good'
        : state === 'disconnected'
          ? 'poor'
          : state === 'failed'
            ? 'lost'
            : undefined;
    if (quality) useCallStore.getState().patchCall({ quality });
  }

  private teardown(): void {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        /* already closed */
      }
      this.pc = null;
    }
    if (this.audioEl) {
      this.audioEl.srcObject = null;
      this.audioEl.remove();
      this.audioEl = null;
    }
    this.callId = null;
    this.startPromise = null;
    this.remoteReady = false;
    this.pendingCandidates = [];
    const w = window as unknown as { __rtcPc?: RTCPeerConnection; __rtcRemoteStream?: MediaStream };
    w.__rtcPc = undefined;
    w.__rtcRemoteStream = undefined;
  }
}

export const mediaService = new MediaService();
