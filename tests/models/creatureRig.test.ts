import { describe, expect, it } from 'vitest';
import { getModel } from '../../src/core/models';
import { CreatureRig, HumanoidRig, createRig } from '../../src/play/rig';

const pose = (speed: number) => ({ speed, grounded: true, swing: null, combo: 0 });

describe('동물 걷기 동작', () => {
  it('네 발 동물은 동물 리그, 사람은 사람 리그를 쓴다', () => {
    expect(createRig(getModel('pig'))).toBeInstanceOf(CreatureRig);
    expect(createRig(getModel('seagull'))).toBeInstanceOf(CreatureRig);
    expect(createRig(getModel('odysseus'))).toBeInstanceOf(HumanoidRig);
  });

  it('움직이면 대각선 다리끼리 같이, 반대쪽은 거꾸로 움직이고 멈추면 모인다', () => {
    const pig = getModel('pig');
    const rig = new CreatureRig(pig);
    const leg = (i: number) => pig.getObjectByName(`leg${i}`)!.rotation.x;
    for (let i = 0; i < 12; i++) rig.update(1 / 30, pose(1));
    expect(Math.abs(leg(0))).toBeGreaterThan(0.01);
    expect(leg(0)).toBeCloseTo(leg(3));
    expect(leg(1)).toBeCloseTo(-leg(0));
    for (let i = 0; i < 90; i++) rig.update(1 / 30, pose(0));
    expect(Math.abs(leg(0))).toBeLessThan(0.02);
  });

  it('새는 날개를 파닥인다', () => {
    const gull = getModel('seagull');
    const rig = new CreatureRig(gull);
    const wing = gull.getObjectByName('wingL')!;
    const seen = new Set<number>();
    for (let i = 0; i < 10; i++) {
      rig.update(1 / 30, { ...pose(1), grounded: false });
      seen.add(Math.round(wing.rotation.z * 100));
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});
