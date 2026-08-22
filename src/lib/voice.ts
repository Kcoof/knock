import type { SupabaseClient } from "@supabase/supabase-js";

export interface VoiceHandlers {
  onParticipants: (participants: Array<{ key: string; username: string; speaking: boolean }>) => void;
  onError: (message: string) => void;
}

interface VoiceSignal {
  to: string;
  from: string;
  kind: "offer" | "answer" | "ice";
  payload: unknown;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * Voice inside rooms (spec §13): a small WebRTC mesh between everyone who
 * joined voice in the same room. Signaling rides a dedicated Supabase
 * Realtime channel; audio is strictly peer-to-peer — never recorded, never
 * stored, nothing touches our servers beyond session negotiation.
 */
export class VoiceService {
  private channel: ReturnType<SupabaseClient["channel"]> | null = null;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, MediaStream>();
  private usernames = new Map<string, string>();
  private speaking = new Map<string, boolean>();
  private analysers = new Map<string, { analyser: AnalyserNode; data: Uint8Array }>();
  private audioContext: AudioContext | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private key: string;
  private username: string;

  constructor(
    private supabase: SupabaseClient,
    private roomId: string,
    identity: { key: string; username: string },
    private handlers: VoiceHandlers,
  ) {
    this.key = identity.key;
    this.username = identity.username;
  }

  async join(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.handlers.onError("Microphone access was denied — check browser permissions.");
      return;
    }

    this.channel = this.supabase.channel(`voice:${this.roomId}`, {
      config: { presence: { key: this.key } },
    });

    this.channel
      .on("presence", { event: "sync" }, () => {
        const state = this.channel!.presenceState<{ key: string; username: string }>();
        const others = Object.values(state)
          .flat()
          .filter((p) => p.key !== this.key);
        for (const p of others) {
          this.usernames.set(p.key, p.username);
          // the newcomer initiates toward peers already in voice
          if (!this.peers.has(p.key)) {
            void this.connectTo(p.key, true);
          }
        }
        const gone = [...this.peers.keys()].filter((k) => !others.some((o) => o.key === k));
        for (const k of gone) this.closePeer(k);
        this.emitParticipants();
      })
      .on("broadcast", { event: "sig" }, ({ payload }) => {
        void this.onSignal(payload as VoiceSignal);
      });

    await this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await this.channel!.track({ key: this.key, username: this.username });
      }
    });

    this.startSpeakingPoll();
  }

  private async connectTo(peerKey: string, initiator: boolean): Promise<void> {
    if (this.peers.has(peerKey)) return;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(peerKey, pc);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) pc.addTrack(track, this.localStream);
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.sendSignal(peerKey, { kind: "ice", payload: event.candidate.toJSON() });
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      this.remoteStreams.set(peerKey, stream);
      this.attachAnalyser(peerKey, stream);
      this.emitParticipants();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.closePeer(peerKey);
        this.emitParticipants();
      }
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.sendSignal(peerKey, { kind: "offer", payload: offer });
    }
  }

  private async onSignal(signal: VoiceSignal): Promise<void> {
    if (signal.to !== this.key) return;
    const from = signal.from;

    if (signal.kind === "offer") {
      if (!this.peers.has(from)) await this.connectTo(from, false);
      const pc = this.peers.get(from);
      if (!pc || pc.signalingState === "have-local-offer") return; // glare: ignore
      await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal(from, { kind: "answer", payload: answer });
      return;
    }

    const pc = this.peers.get(from);
    if (!pc) return;
    if (signal.kind === "answer") {
      await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
    } else if (signal.kind === "ice") {
      try {
        await pc.addIceCandidate(signal.payload as RTCIceCandidateInit);
      } catch {
        // candidates arriving before description settle — safe to skip
      }
    }
  }

  private async sendSignal(to: string, body: Omit<VoiceSignal, "to" | "from">): Promise<void> {
    await this.channel?.send({
      type: "broadcast",
      event: "sig",
      payload: { to, from: this.key, ...body } as VoiceSignal,
    });
  }

  private attachAnalyser(peerKey: string, stream: MediaStream): void {
    if (!this.audioContext) this.audioContext = new AudioContext();
    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.analysers.set(peerKey, { analyser, data: new Uint8Array(analyser.frequencyBinCount) });
    } catch {
      // speaking detection is best-effort
    }
  }

  private startSpeakingPoll(): void {
    this.pollTimer = setInterval(() => {
      for (const [key, { analyser, data }] of this.analysers) {
        analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (const v of data) sum += v;
        const avg = sum / data.length;
        const now = avg > 18;
        if (this.speaking.get(key) !== now) {
          this.speaking.set(key, now);
          this.emitParticipants();
        }
      }
      // local mic level
      if (this.localStream && this.localStream.getAudioTracks()[0]?.enabled) {
        if (!this.analysers.has("local") && this.audioContext === null) {
          this.audioContext = new AudioContext();
        }
        if (this.audioContext && !this.analysers.has("local")) {
          try {
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            this.analysers.set("local", { analyser, data: new Uint8Array(analyser.frequencyBinCount) });
          } catch {
            /* ignore */
          }
        }
        const local = this.analysers.get("local");
        if (local) {
          local.analyser.getByteFrequencyData(local.data as Uint8Array<ArrayBuffer>);
          let sum = 0;
          for (const v of local.data) sum += v;
          const now = sum / local.data.length > 18;
          if (this.speaking.get(this.key) !== now) {
            this.speaking.set(this.key, now);
            this.emitParticipants();
          }
        }
      }
    }, 250);
  }

  private closePeer(peerKey: string): void {
    this.peers.get(peerKey)?.close();
    this.peers.delete(peerKey);
    this.remoteStreams.delete(peerKey);
    this.analysers.delete(peerKey);
    this.speaking.delete(peerKey);
  }

  private emitParticipants(): void {
    const participants = [
      { key: this.key, username: this.username, speaking: this.speaking.get(this.key) ?? false },
      ...[...this.peers.keys()].map((k) => ({
        key: k,
        username: this.usernames.get(k) ?? "builder",
        speaking: this.speaking.get(k) ?? false,
      })),
    ];
    this.handlers.onParticipants(participants);
  }

  getStream(peerKey: string): MediaStream | undefined {
    return this.remoteStreams.get(peerKey);
  }

  setMuted(muted: boolean): void {
    for (const track of this.localStream?.getAudioTracks() ?? []) track.enabled = !muted;
    if (muted) this.speaking.set(this.key, false);
    this.emitParticipants();
  }

  leave(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    for (const key of [...this.peers.keys()]) this.closePeer(key);
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    void this.audioContext?.close();
    if (this.channel) void this.supabase.removeChannel(this.channel);
    this.channel = null;
    this.handlers.onParticipants([]);
  }
}
