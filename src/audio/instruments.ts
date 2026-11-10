import type { Instrument, NoteEvent } from '../types/contracts';

export interface Voice { stop(at: number): void }
const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteHz(note: string): number {
  const m = /^([A-G])(#|b)?([0-8])$/.exec(note);
  if (!m) throw new Error('Invalid note: ' + note);
  const midi = (Number(m[3]) + 1) * 12 + semitones[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noises.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let state = 1234567;
    for (let i = 0; i < data.length; i++) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      data[i] = (state >>> 0) / 2147483648 - 1;
    }
    noises.set(ctx, buffer);
  }
  return buffer;
}

/** Each voice owns its nodes; ended notes disconnect immediately. */
export function playNote(ctx: BaseAudioContext, out: AudioNode, instrument: Instrument, note: NoteEvent, at: number, seconds: number, gain: number, onEnd: () => void): Voice {
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  const envelope = ctx.createGain();
  envelope.connect(out); nodes.push(envelope);
  const drum = instrument === 'drum';
  const attack = instrument === 'pad' ? .12 : instrument === 'flute' ? .035 : .004;
  const release = instrument === 'pad' ? .25 : .055;
  const duration = drum ? (note.note === 'hat' ? .06 : .20) : Math.max(attack + .02, seconds);
  const peak = Math.max(.0001, gain * (note.vel ?? .8) * (drum ? .18 : .14));
  envelope.gain.setValueAtTime(.0001, at);
  envelope.gain.linearRampToValueAtTime(peak, at + attack);
  if (instrument === 'lyre' || drum) {
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration + release);
  } else {
    envelope.gain.setValueAtTime(peak * .8, at + duration);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration + release);
  }
  if (drum && (note.note === 'snare' || note.note === 'hat')) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = note.note === 'hat' ? 6500 : 1400;
    source.connect(filter).connect(envelope);
    sources.push(source); nodes.push(filter);
  } else {
    const osc = ctx.createOscillator();
    const hz = drum ? (note.note === 'kick' ? 120 : 200) : noteHz(note.note);
    osc.type = instrument === 'lyre' || instrument === 'bass' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(hz, at);
    if (drum) osc.frequency.exponentialRampToValueAtTime(note.note === 'kick' ? 42 : 95, at + .16);
    osc.connect(envelope); sources.push(osc);
    if (instrument === 'flute') {
      const vibrato = ctx.createOscillator(), depth = ctx.createGain();
      vibrato.frequency.value = 5.1; depth.gain.value = hz * .006;
      vibrato.connect(depth).connect(osc.frequency);
      sources.push(vibrato); nodes.push(depth);
    }
    if (instrument === 'pad') {
      const overtone = ctx.createOscillator(), blend = ctx.createGain();
      overtone.type = 'sine'; overtone.frequency.value = hz * 2; blend.gain.value = .18;
      overtone.connect(blend).connect(envelope); sources.push(overtone); nodes.push(blend);
    }
  }
  let ended = 0;
  for (const source of sources) {
    source.onended = () => {
      source.disconnect();
      if (++ended === sources.length) { nodes.forEach(n => n.disconnect()); onEnd(); }
    };
    source.start(at); source.stop(at + duration + release + .01);
  }
  return {
    stop(time) {
      envelope.gain.cancelScheduledValues(time);
      envelope.gain.setTargetAtTime(.0001, time, .008);
      sources.forEach(source => { try { source.stop(time + .03); } catch { /* Already ended. */ } });
    },
  };
}
