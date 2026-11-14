import { describe, expect, it } from 'vitest';
import { CHAPTER_IDS } from '../../src/types/contracts';
import { chapters, islands } from '../../src/content';
import { newSave, normalizeSave } from '../../src/game/save';
import {
  advanceFrontier, chapterState, formatPlayTime, islandFinds, islandRoute, islandState, subjectScores, totalFinds,
} from '../../src/game/progress';

describe('지도 진행 상황', () => {
  it('끝낸 장·지금 차례·잠긴 장을 구분한다', () => {
    const data = { chapter: 'ch04' as const, completed: ['ch01', 'ch02', 'ch03'] as typeof CHAPTER_IDS[number][] };
    expect(chapterState(data, 'ch02')).toBe('done');
    expect(chapterState(data, 'ch04')).toBe('next');
    expect(chapterState(data, 'ch05')).toBe('locked');
    expect(chapterState(null, 'ch01')).toBe('next');
    expect(chapterState(null, 'ch02')).toBe('locked');
  });

  it('앞 장을 다시 해도 다음에 할 장은 뒤로 가지 않는다', () => {
    expect(advanceFrontier('ch05', 'ch04')).toBe('ch05');
    expect(advanceFrontier('ch05', 'ch02')).toBe('ch05');
    expect(advanceFrontier('ch04', 'ch04')).toBe('ch05');
    expect(advanceFrontier('ch17', 'ch17')).toBe('ch17');
    expect(advanceFrontier('ch16', 'ch16')).toBe('ch17');
  });

  it('섬은 이야기 순서대로 한 번씩만 나오고, 모든 장의 섬이 지도에 있다', () => {
    const route = islandRoute(chapters);
    expect(new Set(route).size).toBe(route.length);
    expect(route[0]).toBe(chapters.ch01?.island);
    for (const id of CHAPTER_IDS) expect(route).toContain(chapters[id]?.island);
    for (const isl of route) expect(islands[isl]?.hubPos).toHaveLength(2);
  });

  it('섬 상태는 장 상태를 합친 것', () => {
    expect(islandState(['done', 'next', 'locked'])).toBe('next');
    expect(islandState(['done', 'done'])).toBe('done');
    expect(islandState(['locked', 'locked'])).toBe('locked');
  });

  it('보물상자·부엉이 신전은 섬 이름이 붙은 키로 센다', () => {
    const layout = islands.ogygia!;
    const chest = layout.chests[0];
    const data = { opened: chest ? [`ogygia:${chest.id}`, `cyclops:${chest.id}`] : [], shrines: [] };
    const f = islandFinds(data, layout);
    expect(f.chestTotal).toBe(layout.chests.length);
    expect(f.chests).toBe(chest ? 1 : 0);
    const all = totalFinds(null, Object.values(islands).filter((l) => !!l) as NonNullable<typeof layout>[]);
    expect(all.chests).toBe(0);
    expect(all.chestTotal).toBeGreaterThan(0);
  });

  it('과목별 점수와 놀이 시간을 읽기 쉽게', () => {
    const save = newSave(2);
    save.learning.stats.math = { total: 4, firstTry: 3 };
    const math = subjectScores(save).find((s) => s.subject === 'math');
    expect(math).toMatchObject({ total: 4, firstTry: 3, label: '수학' });
    expect(formatPlayTime(30)).toBe('1분 미만');
    expect(formatPlayTime(12 * 60)).toBe('12분');
    expect(formatPlayTime(3600)).toBe('1시간');
    expect(formatPlayTime(3725)).toBe('1시간 2분');
  });

  it('저장 데이터의 놀이 시간 알림은 0·20·30·40분만', () => {
    expect(newSave(1).settings.timeLimit).toBe(0);
    expect(normalizeSave({ version: 1, grade: 1, settings: { master: 1, sfx: 1, bgm: 1 } })?.settings.timeLimit).toBe(0);
    expect(normalizeSave({ version: 1, grade: 1, settings: { master: 1, sfx: 1, bgm: 1, timeLimit: 30 } })?.settings.timeLimit).toBe(30);
    expect(normalizeSave({ version: 1, grade: 1, settings: { master: 1, sfx: 1, bgm: 1, timeLimit: 999 } })?.settings.timeLimit).toBe(0);
  });
});
