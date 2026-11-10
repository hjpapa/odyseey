declare module 'zzfx' {
  export const ZZFX: {
    audioContext: AudioContext;
    sampleRate: number;
    volume: number;
    buildSamples(...parameters: (number | undefined)[]): number[];
  };
}
