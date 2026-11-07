/** 별가루 파티클과 떠오르는 글자 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, type Scene, Vector3 } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const MAX = 400;

export class Effects {
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private next = 0;
  private geo = new BufferGeometry();
  private points: Points;
  private texts: { obj: CSS2DObject; t: number }[] = [];
  private tmp = new Color();

  constructor(private scene: Scene) {
    this.pos.fill(-9999);
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new BufferAttribute(this.col, 3));
    this.points = new Points(
      this.geo,
      new PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: AdditiveBlending }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** 별가루 터뜨리기 */
  burst(at: Vector3, color = '#ffe066', count = 18, speed = 5, up = 3) {
    this.tmp.set(color);
    for (let i = 0; i < count; i++) {
      const k = this.next;
      this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.pos.set([at.x, at.y, at.z], k * 3);
      this.vel.set([Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s], k * 3);
      const v = 0.8 + Math.random() * 0.4;
      this.col.set([this.tmp.r * v, this.tmp.g * v, this.tmp.b * v], k * 3);
      this.life[k] = 0.6 + Math.random() * 0.5;
    }
  }

  /** 3D 위치에 떠오르는 글자 (예: +5 🫒) */
  floatText(at: Vector3, text: string) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.copy(at);
    this.scene.add(obj);
    this.texts.push({ obj, t: 1 });
  }

  update(dt: number) {
    for (let k = 0; k < MAX; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      const i = k * 3;
      if (this.life[k] <= 0) {
        this.pos[i + 1] = -9999;
        continue;
      }
      this.vel[i + 1] -= 9 * dt;
      this.pos[i] += this.vel[i] * dt;
      this.pos[i + 1] += this.vel[i + 1] * dt;
      this.pos[i + 2] += this.vel[i + 2] * dt;
    }
    (this.geo.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as BufferAttribute).needsUpdate = true;
    for (const t of this.texts) {
      t.t -= dt;
      if (t.t <= 0) {
        t.obj.element.remove();
        this.scene.remove(t.obj);
      }
    }
    this.texts = this.texts.filter((t) => t.t > 0);
  }

  dispose() {
    for (const t of this.texts) t.obj.element.remove();
    this.texts = [];
    this.geo.dispose();
  }
}

export function label(text: string, cls = 'nametag'): CSS2DObject {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return new CSS2DObject(el);
}

export const tmpV = new Vector3();
