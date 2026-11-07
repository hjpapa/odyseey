/** 챕터·섬 데이터 로더 (data/chapters/*.json, data/islands/*.json) */
import type { ChapterData, ChapterId, IslandId, IslandLayout } from './types/contracts';

const chapterFiles = import.meta.glob<ChapterData>('../data/chapters/*.json', { eager: true, import: 'default' });
const islandFiles = import.meta.glob<IslandLayout>('../data/islands/*.json', { eager: true, import: 'default' });

/** [파일 경로, 데이터] — 검증용 */
export const chapterEntries = Object.entries(chapterFiles);
export const islandEntries = Object.entries(islandFiles);

export const chapters: Partial<Record<ChapterId, ChapterData>> = {};
for (const [, data] of chapterEntries) chapters[data.id] = data;

export const islands: Partial<Record<IslandId, IslandLayout>> = {};
for (const [, data] of islandEntries) islands[data.id] = data;
