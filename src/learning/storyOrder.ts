import type { Grade, OrderQuestion } from '../types/contracts';
import type { Rng } from '../core/rng';
import ch03 from '../../data/chapters/ch03.json';
import ch04 from '../../data/chapters/ch04.json';
import ch05 from '../../data/chapters/ch05.json';
import ch06 from '../../data/chapters/ch06.json';
import ch07 from '../../data/chapters/ch07.json';
import ch08 from '../../data/chapters/ch08.json';
import ch09 from '../../data/chapters/ch09.json';
import ch10 from '../../data/chapters/ch10.json';
import ch11 from '../../data/chapters/ch11.json';

const MEMORIES = [ch03, ch04, ch05, ch06, ch07, ch08, ch09, ch10, ch11];

/** 12장에서 나우시카에게 들려준 회상. 실제 3~11장 제목과 장 번호를 그대로 쓴다. */
export function storyOrderQuestion(grade: Grade, rng: Rng): OrderQuestion {
  const sequence = rng.shuffle(MEMORIES).slice(0, grade + 2).sort((a, b) => a.no - b.no);
  const items = rng.shuffle(sequence.map((chapter) => chapter.title));
  return {
    id: 'story-order:' + sequence.map((chapter) => chapter.id).join(','),
    subject: 'manners',
    grade,
    kind: 'order',
    prompt: '지난 모험을 일어난 순서대로 골라요.',
    emoji: '⛵',
    items,
    answerOrder: sequence.map((chapter) => items.indexOf(chapter.title)),
    hint: '먼저 들른 섬부터 떠올려 보세요.',
    explain: sequence.map((chapter) => chapter.title).join(' → '),
  };
}
