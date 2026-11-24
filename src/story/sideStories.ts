import storyData from '../../data/side-stories.json';
import type { ChapterId, IslandId } from '../types/contracts';

/** Optional, child-friendly retellings of specific passages in Homer's Odyssey. */
export interface OdysseySideStory {
  id: string;
  island: IslandId;
  unlockAfter: ChapterId;
  emoji: string;
  title: string;
  place: string;
  paragraphs: string[];
  reflect: string;
  source: { book: number; passage: string; url: string };
}

export const ODYSSEY_SIDE_STORIES = storyData as readonly OdysseySideStory[];

export function sideStoriesAt(island: IslandId): readonly OdysseySideStory[] {
  return ODYSSEY_SIDE_STORIES.filter((story) => story.island === island);
}

/** Use completed chapters, including shared-island chapters, to avoid spoilers. */
export function sideStoryUnlocked(story: OdysseySideStory, completed: readonly ChapterId[]): boolean {
  return completed.includes(story.unlockAfter);
}
