import type { AudioApi, BgmId, SfxId } from '../types/contracts';
import { sfxPresets } from './sfx';
import { bgmTracks } from './tracks';
import { TrackPlayer } from './sequencer';

// ZzFX 1.4 creates its shared AudioContext at module evaluation. Never statically
// import it: the entire module (and thus its context) waits for unlock().
let synthPromise: Promise<typeof import('zzfx')> | undefined;
const clamp = (n: number, fallback = 0) => Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
const fade = (ms = 500) => Number.isFinite(ms) ? Math.min(10, Math.max(0, ms / 1000)) : .5;

export function createAudio(): AudioApi {
  let ctx: AudioContext | undefined, synth: typeof import('zzfx')['ZZFX'] | undefined;
  let loading = false;
  const volume = { master: .7, sfx: .7, bgm: .5 };
  let buses: Record<keyof typeof volume, GainNode> | undefined;
  let pending: { id: BgmId; fade: number } | undefined;
  let current: { id: BgmId; player: TrackPlayer } | undefined;
  const players = new Set<TrackPlayer>();
  let listening = false;
  let queuedSfx = 0;
  const buffers = new Map<SfxId, AudioBuffer>();
  const active = new Set<AudioBufferSourceNode>();
  const lastPlayed = new Map<SfxId, number>();
  const hidden = () => typeof document !== 'undefined' && document.hidden;
  const onVisibility = () => {
    if (hidden()) {
      current?.player.pause();
      for (const player of players) if (player !== current?.player) player.stop(0);
    }
    else {
      void ctx?.resume().then(() => { if (!hidden()) current?.player.start(.15); }).catch(() => {});
    }
  };
  function listen(enabled: boolean) {
    if (typeof document === 'undefined' || enabled === listening) return;
    document[enabled ? 'addEventListener' : 'removeEventListener']('visibilitychange', onVisibility);
    listening = enabled;
  }
  function startPending() {
    if (!ctx || !buses || !pending) return;
    const request = pending;
    if (current?.id === request.id) return;
    current?.player.stop(hidden() ? 0 : request.fade);
    const player: TrackPlayer = new TrackPlayer(ctx, bgmTracks[request.id], buses.bgm, () => players.delete(player));
    players.add(player);
    current = { id: request.id, player };
    listen(true);
    if (!hidden()) current.player.start(request.fade);
  }
  const audio: AudioApi = {
    unlock() {
      if (ctx) { void ctx.resume().catch(() => {}); return; }
      if (loading || typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
      loading = true;
      synthPromise ??= import('zzfx').catch(error => { synthPromise = undefined; throw error; });
      void synthPromise.then(({ ZZFX }) => {
        synth = ZZFX; ctx = ZZFX.audioContext;
        buses = { master: ctx.createGain(), sfx: ctx.createGain(), bgm: ctx.createGain() };
        buses.sfx.connect(buses.master); buses.bgm.connect(buses.master); buses.master.connect(ctx.destination);
        for (const channel of ['master', 'sfx', 'bgm'] as const) buses[channel].gain.value = volume[channel];
        void ctx.resume().catch(() => {});
        loading = false;
        startPending();
      }).catch(() => { loading = false; });
    },
    get unlocked() { return ctx !== undefined; },
    sfx(id, opts) {
      if (!ctx && loading && synthPromise) {
        // The very first click also makes a sound after the lazy module is ready.
        // Keep only the latest gesture, and never replay stale effects.
        const ticket = ++queuedSfx, requestedAt = Date.now();
        void synthPromise.then(async () => {
          await ctx?.resume();
          if (ticket === queuedSfx && Date.now() - requestedAt < 700) audio.sfx(id, opts);
        }).catch(() => {});
        return;
      }
      if (!ctx || !synth || !buses || hidden() || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const frequent = id.startsWith('step_') || ['wave', 'swim', 'splash'].includes(id);
      if (active.size >= 24 || now - (lastPlayed.get(id) ?? -Infinity) < (frequent ? .07 : .025)) return;
      lastPlayed.set(id, now);
      let buffer = buffers.get(id);
      if (!buffer) {
        const samples = synth.buildSamples(...sfxPresets[id]);
        buffer = ctx.createBuffer(1, samples.length, synth.sampleRate);
        buffer.getChannelData(0).set(samples); buffers.set(id, buffer);
      }
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = buffer;
      source.playbackRate.value = Number.isFinite(opts?.pitch) ? Math.max(.25, Math.min(4, opts!.pitch!)) : 1;
      gain.gain.value = clamp(opts?.volume ?? 1, 1);
      source.connect(gain).connect(buses.sfx);
      active.add(source);
      source.onended = () => { active.delete(source); source.disconnect(); gain.disconnect(); };
      source.start();
    },
    playBgm(id, opts) { pending = { id, fade: fade(opts?.fadeMs) }; startPending(); },
    stopBgm(fadeMs) {
      pending = undefined;
      for (const player of players) player.stop(player === current?.player && !hidden() ? fade(fadeMs) : 0);
      current = undefined;
      listen(false);
    },
    setVolume(channel, value) {
      volume[channel] = clamp(value, volume[channel]);
      if (ctx && buses) buses[channel].gain.setTargetAtTime(volume[channel], ctx.currentTime, .015);
    },
  };
  return audio;
}
