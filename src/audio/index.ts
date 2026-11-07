/**
 * [임시 구현 — Codex A3 가 교체]
 * 지금은 소리를 내지 않는 빈 오디오입니다. 계약: AudioApi (src/types/contracts.ts)
 */
import type { AudioApi } from '../types/contracts';

export function createAudio(): AudioApi {
  let unlocked = false;
  return {
    unlock() {
      unlocked = true;
    },
    get unlocked() {
      return unlocked;
    },
    sfx() {},
    playBgm() {},
    stopBgm() {},
    setVolume() {},
  };
}
