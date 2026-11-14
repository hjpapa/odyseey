import { describe, expect, it } from 'vitest';
import { englishWords, hanjaList, mannersScenes } from '../../src/learning/data';
import { newSave } from '../../src/game/save';
import { describeMissed, parentReport } from '../../src/game/parentReport';

describe('보호자 모드 기록', () => {
  it('틀린 문제를 보호자가 알아보기 쉬운 한 줄로 바꾼다', () => {
    const w = englishWords[0];
    const c = hanjaList[0];
    const m = mannersScenes[0];
    expect(describeMissed({ subject: 'english', id: `${w.id}:spell`, grade: 1 })).toBe(`${w.emoji} ${w.word} (${w.meaningKo})`);
    expect(describeMissed({ subject: 'hanja', id: `${c.id}:hunEum`, grade: 1 })).toBe(`${c.char} (${c.hun} ${c.eum})`);
    expect(describeMissed({ subject: 'manners', id: m.id, grade: 1 })).toContain(m.emoji);
    expect(describeMissed({
      subject: 'math', id: 'math:add:3+4', grade: 1,
      question: { id: 'math:add:3+4', subject: 'math', grade: 1, kind: 'number', prompt: '3 + 4 = ?', answer: 7 },
    })).toBe('🔢 3 + 4 = ?');
    expect(describeMissed({ subject: 'english', id: 'en-없는단어', grade: 1 })).toBeNull();
  });

  it('최근에 틀린 것부터 8개까지, 같은 것은 한 번만', () => {
    const save = newSave(3);
    const words = englishWords.slice(0, 10);
    save.learning.review = [
      ...words.map((w) => ({ subject: 'english' as const, id: `${w.id}:spell`, grade: 1 as const })),
      { subject: 'english', id: `${words[9].id}:meaning`, grade: 1 },
    ];
    save.completed = ['ch01', 'ch02'];
    save.settings.timeLimit = 30;
    const r = parentReport(save, 125);
    expect(r.missed).toHaveLength(8);
    expect(r.missed[0]).toContain(words[9].word);
    expect(new Set(r.missed).size).toBe(8);
    expect(r).toMatchObject({ grade: 3, completed: 2, totalChapters: 17, sessionSeconds: 125, timeLimit: 30 });
    expect(r.subjects).toHaveLength(5);
  });
});
