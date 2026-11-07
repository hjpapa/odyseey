import { Color, MeshBasicMaterial, MeshToonMaterial } from 'three';

export const palette = {
  skin: '#efbe91', skinDark: '#ac714d', cream: '#fff0ce', white: '#fffaf0',
  ink: '#263648', hair: '#533a31', wood: '#995c38', woodLight: '#cc9857',
  gold: '#edc560', bronze: '#b8884d', stone: '#b9c6cd', marble: '#eee8dc',
  sea: '#54b7cb', blue: '#487bc3', leaf: '#69994b', leafLight: '#a1c965',
  purple: '#9d79bd', rose: '#e69aaf', coral: '#db7863', sand: '#e7ce93',
} as const;
const toons = new Map<string, MeshToonMaterial>(), lights = new Map<string, MeshBasicMaterial>();
export function toon(color: string): MeshToonMaterial {
  const key = new Color(color).getHexString();
  let material = toons.get(key);
  if (!material) { material = new MeshToonMaterial({ color: '#' + key }); toons.set(key, material); }
  return material;
}
export function glow(color: string): MeshBasicMaterial {
  let material = lights.get(color);
  if (!material) { material = new MeshBasicMaterial({ color }); lights.set(color, material); }
  return material;
}
