import type { BgmId, BgmLayer, BgmPattern, BgmTrack, Instrument, NoteEvent, ScaleMode } from '../../types/contracts';

interface Score {
  id: BgmId; title: string; bpm: number; root: string; mode: ScaleMode;
  melody: number[]; answer: number[]; lead?: 'lyre' | 'flute';
  rhythm?: 'dance' | 'march' | 'gentle' | 'none';
}
const modes: Record<ScaleMode, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
};
const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Four-bar phrases with a call, response and homeward cadence (16 bars/loop). */
export function compose(score: Score): BgmTrack {
  const root = chromatic.indexOf(score.root);
  const pitch = (degree: number, octave: number) => {
    const semitone = root + modes[score.mode][((degree % 7) + 7) % 7] + 12 * (octave + Math.floor(degree / 7));
    return chromatic[((semitone % 12) + 12) % 12] + Math.floor(semitone / 12);
  };
  const event = (step: number, degree: number, len: number, octave = 4, vel = .7): NoteEvent =>
    ({ step, note: pitch(degree, octave), len, vel });
  const pattern = (id: string, motif: number[], closing: boolean): BgmPattern => {
    const lead: NoteEvent[] = [], pluck: NoteEvent[] = [], bass: NoteEvent[] = [], pad: NoteEvent[] = [], drums: NoteEvent[] = [];
    for (let bar = 0; bar < 4; bar++) {
      const base = bar * 16, harmony = [0, 3, 4, 0][bar];
      motif.forEach((degree, i) => {
        if (degree < 0) return;
        lead.push(event(base + i * 2, closing && bar === 3 && i >= 5 ? (i === 7 ? 0 : 2) : degree, i === 7 ? 2 : 1.5, 4, i % 4 === 0 ? .78 : .59));
      });
      for (let i = 0; i < 4; i++) pluck.push(event(base + i * 4 + 1, harmony + [0, 2, 4, 2][i], 3, 3, .42));
      bass.push(event(base, harmony, 7, 2, .57), event(base + 8, harmony + 4, 7, 2, .46));
      for (const degree of [harmony, harmony + 2, harmony + 4]) pad.push(event(base, degree, 15, 3, .26));
      const rhythm = score.rhythm ?? 'gentle';
      if (rhythm !== 'none') {
        drums.push({ step: base, note: 'kick', len: 1, vel: .4 }, { step: base + 8, note: rhythm === 'gentle' ? 'tom' : 'snare', len: 1, vel: .28 });
        if (rhythm === 'march') drums.push({ step: base + 6, note: 'tom', len: 1, vel: .3 }, { step: base + 14, note: 'snare', len: 1, vel: .25 });
        if (rhythm !== 'gentle') for (const step of [2, 6, 10, 14]) drums.push({ step: base + step, note: 'hat', len: 1, vel: .22 });
      }
    }
    const layer = (instrument: Instrument, notes: NoteEvent[], gain: number): BgmLayer => ({ instrument, notes, gain });
    return { id, stepsPerBar: 16, bars: 4, layers: [
      layer(score.lead ?? 'lyre', lead, .85), layer('lyre', pluck, .42), layer('bass', bass, .6),
      layer('pad', pad, .38), ...(drums.length ? [layer('drum', drums, .45)] : []),
    ] };
  };
  return {
    id: score.id, title: score.title, bpm: score.bpm, root: score.root, mode: score.mode,
    patterns: [pattern('call', score.melody, false), pattern('answer', score.answer, false), pattern('home', score.answer, true)],
    sequence: ['call', 'answer', 'call', 'home'], loopFrom: 0,
  };
}
