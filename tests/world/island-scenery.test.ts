import { describe, expect, it } from 'vitest';
import { Box3, Color, Fog, Mesh, Scene, Vector3 } from 'three';
import { islands } from '../../src/content';
import type { IslandLayout } from '../../src/types/contracts';
import { createDestinationScenery, destinationAtmosphere, destinationFlora } from '../../src/world/islandScenery';
import { createEnvironment } from '../../src/world/environment';
import { IslandWorld } from '../../src/world/island';
import { SOLID_RADIUS } from '../../src/world/props';

const outdoor = Object.values(islands).filter((layout): layout is IslandLayout => layout?.kind === 'island');

describe('섬별 배경의 길과 그리기 부담', () => {
  it.each(outdoor.map((layout) => [layout.id, layout] as const))('%s: 배경이 육지를 침범하거나 그림자를 늘리지 않는다', (_id, layout) => {
    const scenery = createDestinationScenery(layout);
    let meshes = 0;
    let triangles = 0;
    scenery.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshes++;
      expect(object.castShadow).toBe(false);
      const positions = object.geometry.attributes.position;
      triangles += positions.count / 3;
      for (let i = 0; i < positions.count; i++) {
        expect(Number.isFinite(positions.getY(i))).toBe(true);
        expect(Math.hypot(positions.getX(i), positions.getZ(i))).toBeGreaterThan(layout.terrain.radius + 8);
      }
    });
    expect(meshes).toBeGreaterThan(0);
    expect(meshes).toBeLessThanOrEqual(12);
    expect(triangles).toBeLessThan(6000);
  });

  it('여러 섬이 같은 실루엣을 다시 쓰지 않는다', () => {
    const shapes = outdoor.map((layout) => {
      const size = new Box3().setFromObject(createDestinationScenery(layout)).getSize(new Vector3());
      return size.toArray().map((n) => Math.round(n)).join(',');
    });
    expect(new Set(shapes).size).toBeGreaterThanOrEqual(8);
  });

  it.each(outdoor.map((layout) => [layout.id, layout] as const))('%s: 작은 식물과 수평선이 충돌체를 더하지 않는다', (_id, layout) => {
    const world = new IslandWorld(layout, 'memory');
    const expected = layout.props.filter((p) => SOLID_RADIUS[p.model]).length;
    expect(world.colliders).toHaveLength(expected);
    for (const id of destinationFlora(layout.id).props) expect(SOLID_RADIUS[id]).toBeUndefined();
  });

  it('궁전 모자이크는 지면과 기존 벽을 바꾸지 않는다', () => {
    const layout = islands.ithacaPalace!;
    const world = new IslandWorld(layout, 'day');
    expect(world.ground(0, 0)).toBe(1);
    expect(world.ground(...layout.spawn)).toBe(1);
    expect(world.scene.getObjectByName('scenery:ithacaPalace')).toBeDefined();
    expect(world.colliders.some((c) => c.tag === 'wall')).toBe(true);
  });
});

describe('섬별 빛과 기존 바다 환경', () => {
  it('그림자 나라는 밝은 안개와 잔잔한 바다를 쓰며 기존 회상 환경은 유지된다', () => {
    const scene = new Scene();
    const shadow = createEnvironment(scene, 'memory', destinationAtmosphere('underworld'));
    expect((scene.fog as Fog).color.equals(new Color('#a8bad0'))).toBe(true);
    expect(shadow.waveAmp).toBe(0.25);
    expect(shadow.sun.intensity).toBeGreaterThanOrEqual(1.6);
    expect(shadow.mood).toBe('memory');
    expect(createEnvironment(new Scene(), 'memory').waveAmp).toBe(0.8);
    expect(createEnvironment(new Scene(), 'storm').waveAmp).toBe(2.2);
  });
});
