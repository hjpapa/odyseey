// 학습 데이터 형식 검사 (항상 통과해야 함). 분량·분포는 learning.accept.test.ts 에서.
import { describe, expect, it } from 'vitest';
import { englishWords, hanjaList, mannersScenes } from '../../src/learning/data';
import { uniqueIds, validateEnglish, validateHanja, validateManners } from '../helpers/validate';

describe('학습 데이터 형식', () => {
  it('english.json', () => {
    const errors = [...englishWords.flatMap(validateEnglish), ...uniqueIds(englishWords, 'english')];
    expect(errors).toEqual([]);
  });
  it('hanja.json', () => {
    const errors = [...hanjaList.flatMap(validateHanja), ...uniqueIds(hanjaList, 'hanja')];
    expect(errors).toEqual([]);
  });
  it('manners.json', () => {
    const errors = [...mannersScenes.flatMap(validateManners), ...uniqueIds(mannersScenes, 'manners')];
    expect(errors).toEqual([]);
  });
});
