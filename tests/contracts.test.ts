import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BGM_IDS, BOSS_IDS, CHAPTER_IDS, CREATURE_IDS, HUMANOID_IDS, ISLAND_IDS, PROP_IDS, SFX_IDS,
} from '../src/types/contracts';
import { CHILD_STORY } from '../src/story/childStory';
import { MODEL_IDS } from './helpers/validate';

const dupes = (xs: readonly string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe('계약(contracts) 목록', () => {
  it('ID 목록에 중복이 없다', () => {
    for (const list of [SFX_IDS, BGM_IDS, ISLAND_IDS, BOSS_IDS, CHAPTER_IDS, MODEL_IDS]) {
      expect(dupes(list)).toEqual([]);
    }
    expect(MODEL_IDS.length).toBe(HUMANOID_IDS.length + CREATURE_IDS.length + PROP_IDS.length);
  });

  it('모든 보스는 모델이 있다', () => {
    for (const b of BOSS_IDS) expect(MODEL_IDS).toContain(b);
  });
});

describe('아이 원문', () => {
  it('17장 모두 있다', () => {
    expect(Object.keys(CHILD_STORY).sort()).toEqual([...CHAPTER_IDS].sort());
  });

  it('docs/STORY.md 의 아이 원문과 글자까지 같다', () => {
    const md = readFileSync(new URL('../docs/STORY.md', import.meta.url), 'utf8');
    const found = [...md.matchAll(/\*\*아이 원문:\*\* (\d+)\. (.+)$/gm)].map((m) => [Number(m[1]), m[2].trim()] as const);
    expect(found.length).toBe(17);
    for (const [no, text] of found) {
      expect(text).toBe(CHILD_STORY[CHAPTER_IDS[no - 1]]);
    }
  });
});
