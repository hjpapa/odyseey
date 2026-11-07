/** 학습 데이터 (data/learning/*.json) 를 타입과 함께 내보냄 */
import type { EnglishWord, Hanja, MannersScene } from '../types/contracts';
import englishJson from '../../data/learning/english.json';
import hanjaJson from '../../data/learning/hanja.json';
import mannersJson from '../../data/learning/manners.json';

export const englishWords = englishJson as unknown as EnglishWord[];
export const hanjaList = hanjaJson as unknown as Hanja[];
export const mannersScenes = mannersJson as unknown as MannersScene[];
