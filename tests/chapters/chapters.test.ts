// 챕터 데이터 형식 검사 (있는 파일만). 17장 완성은 chapters.accept.test.ts 에서.
import { describe, expect, it } from 'vitest';
import { chapterEntries } from '../../src/content';
import { validateChapter } from '../helpers/validate';

describe('챕터 데이터 형식', () => {
  it('data/chapters/*.json 이 계약과 아이 원문을 지킨다', () => {
    const errors = chapterEntries.flatMap(([file, data]) => validateChapter(data, file));
    expect(errors).toEqual([]);
  });
});
