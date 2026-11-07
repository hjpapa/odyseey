import type { BgmTrack } from '../types/contracts';
import { playNote, type Voice } from './instruments';

interface Cursor { sequence: number; step: number }
/** 25 ms transport ticks schedule 120 ms ahead, independent of rendering FPS. */
export class TrackPlayer {
  readonly output: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private cleanup?: ReturnType<typeof setTimeout>;
  private voices = new Set<Voice>();
  private cursor: Cursor = { sequence: 0, step: 0 };
  private scheduled: { at: number; cursor: Cursor }[] = [];
  private nextAt = 0;
  private stopped = false;
  private readonly stepSeconds: number;
  constructor(private ctx: AudioContext, private track: BgmTrack, bus: AudioNode, private onDisposed: () => void = () => {}) {
    this.output = ctx.createGain();
    this.output.gain.value = 0;
    this.output.connect(bus);
    this.stepSeconds = 60 / track.bpm / 4;
  }
  start(fadeSeconds = .4): void {
    if (this.stopped || this.timer !== undefined) return;
    this.nextAt = this.ctx.currentTime + .02;
    this.output.gain.cancelScheduledValues(this.ctx.currentTime);
    this.output.gain.setValueAtTime(0, this.ctx.currentTime);
    this.output.gain.linearRampToValueAtTime(1, this.ctx.currentTime + Math.max(.02, fadeSeconds));
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
  }
  private tick(): void {
    const now = this.ctx.currentTime;
    this.scheduled = this.scheduled.filter(s => s.at >= now);
    // A throttled tab must never dump a backlog of notes into one instant.
    if (this.nextAt < now - .12) this.nextAt = now + .02;
    while (this.nextAt < now + .12) {
      const pattern = this.track.patterns.find(p => p.id === this.track.sequence[this.cursor.sequence])!;
      this.scheduled.push({ at: this.nextAt, cursor: { ...this.cursor } });
      for (const layer of pattern.layers) for (const note of layer.notes) {
        if (note.step !== this.cursor.step) continue;
        const voice = playNote(this.ctx, this.output, layer.instrument, note, this.nextAt, note.len * this.stepSeconds, layer.gain ?? .7, () => this.voices.delete(voice));
        this.voices.add(voice);
      }
      this.cursor.step++;
      if (this.cursor.step >= pattern.stepsPerBar * pattern.bars) {
        this.cursor.step = 0;
        this.cursor.sequence++;
        if (this.cursor.sequence >= this.track.sequence.length) this.cursor.sequence = this.track.loopFrom;
      }
      this.nextAt += this.stepSeconds;
    }
  }
  pause(): void {
    if (this.stopped) return;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    const pending = this.scheduled.find(s => s.at >= this.ctx.currentTime);
    if (pending) this.cursor = { ...pending.cursor };
    this.scheduled = [];
    this.silence();
  }
  private silence(): void {
    const now = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(0, now, .008);
    this.voices.forEach(v => v.stop(now));
  }
  stop(fadeSeconds = .3): void {
    if (this.stopped) {
      if (fadeSeconds === 0) this.dispose();
      return;
    }
    this.stopped = true;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    const now = this.ctx.currentTime;
    this.output.gain.cancelAndHoldAtTime(now);
    this.output.gain.linearRampToValueAtTime(0, now + Math.max(.01, fadeSeconds));
    if (fadeSeconds === 0) { this.dispose(); return; }
    this.cleanup = setTimeout(() => this.dispose(), fadeSeconds * 1000 + 40);
  }
  private dispose(): void {
    this.silence();
    this.output.disconnect();
    if (this.cleanup !== undefined) clearTimeout(this.cleanup);
    this.cleanup = undefined;
    this.onDisposed();
  }
}
