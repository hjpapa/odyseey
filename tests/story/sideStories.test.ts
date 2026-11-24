import { describe, expect, it } from 'vitest';
import { CHAPTER_IDS, ISLAND_IDS } from '../../src/types/contracts';
import { ODYSSEY_SIDE_STORIES, sideStoriesAt, sideStoryUnlocked } from '../../src/story/sideStories';

describe('선택해서 읽는 원작 곁이야기', () => {
  it('모든 이야기가 실제 섬과 장, 원작 권과 1차 자료를 가리킨다', () => {
    expect(ODYSSEY_SIDE_STORIES.length).toBeGreaterThanOrEqual(6);
    expect(ODYSSEY_SIDE_STORIES.length).toBeLessThanOrEqual(9);
    expect(new Set(ODYSSEY_SIDE_STORIES.map((story) => story.id)).size).toBe(ODYSSEY_SIDE_STORIES.length);
    for (const story of ODYSSEY_SIDE_STORIES) {
      expect(ISLAND_IDS).toContain(story.island);
      expect(CHAPTER_IDS).toContain(story.unlockAfter);
      expect(story.title.length).toBeGreaterThan(0);
      expect(story.paragraphs.length).toBeGreaterThanOrEqual(2);
      expect(story.reflect.length).toBeGreaterThan(0);
      expect(story.source.book).toBeGreaterThanOrEqual(1);
      expect(story.source.book).toBeLessThanOrEqual(24);
      expect(story.source.passage).toContain(story.source.book + '권');
      expect(story.source.url).toMatch(/^https:\/\/en\.wikisource\.org\/wiki\/The_Odyssey_\(Butler\)\/Book_[IVX]+$/);
    }
  });

  it('처음에는 열리지 않고, 끝낸 장의 곁이야기만 열린다', () => {
    expect(ODYSSEY_SIDE_STORIES.filter((story) => sideStoryUnlocked(story, []))).toEqual([]);
    const unlocked = ODYSSEY_SIDE_STORIES.filter((story) => sideStoryUnlocked(story, ['ch01', 'ch02']));
    expect(unlocked.map((story) => story.id)).toEqual(['stars-at-sea', 'inos-returned-veil']);
    expect(sideStoriesAt('scheria').every((story) => !sideStoryUnlocked(story, ['ch11']))).toBe(true);
    expect(sideStoriesAt('scheria').every((story) => sideStoryUnlocked(story, ['ch12']))).toBe(true);
  });

  it('이타카에 도착해도 마지막 권의 과수원은 17장을 끝낸 뒤에 열린다', () => {
    const ithaca = sideStoriesAt('ithaca');
    expect(ithaca.filter((story) => sideStoryUnlocked(story, ['ch13', 'ch14', 'ch15'])).map((story) => story.id))
      .toEqual(['eumaeus-hospitality']);
    expect(ithaca.filter((story) => sideStoryUnlocked(story, CHAPTER_IDS)).map((story) => story.id))
      .toEqual(['eumaeus-hospitality', 'laertes-orchard']);
  });
});
