import { describe, it, expect } from 'vitest';
import { floodFill, hexToRgb } from '../src/games/colorMixer/floodFill';

const W = 10;
const H = 10;

function blank(value = 255) {
  return new Uint8ClampedArray(W * H * 4).fill(value);
}

function setPixel(d: Uint8ClampedArray, x: number, y: number, v: number) {
  const i = (y * W + x) * 4;
  d[i] = v; d[i + 1] = v; d[i + 2] = v;
}

function pixel(d: Uint8ClampedArray, x: number, y: number) {
  const i = (y * W + x) * 4;
  return [d[i], d[i + 1], d[i + 2]];
}

describe('Maka paint bucket flood fill', () => {
  it('parses short and long hex colours', () => {
    expect(hexToRgb('#FFCC00')).toEqual([255, 204, 0]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
  });

  it('fills up to a solid line and leaves the line alone', () => {
    const d = blank();
    for (let y = 0; y < H; y++) setPixel(d, 5, y, 0);
    const count = floodFill(d, W, H, 1, 1, [255, 0, 0]);
    expect(count).toBe(50);
    expect(pixel(d, 0, 0)).toEqual([255, 0, 0]);
    expect(pixel(d, 4, 9)).toEqual([255, 0, 0]);
    expect(pixel(d, 5, 3)).toEqual([0, 0, 0]);
    expect(pixel(d, 6, 3)).toEqual([255, 255, 255]);
  });

  it('covers the soft anti-aliased edge of a line', () => {
    const d = blank();
    for (let y = 0; y < H; y++) {
      setPixel(d, 3, y, 150);
      setPixel(d, 4, y, 0);
    }
    floodFill(d, W, H, 0, 0, [255, 0, 0]);
    expect(pixel(d, 3, 0)).toEqual([255, 0, 0]);
    expect(pixel(d, 4, 0)).toEqual([0, 0, 0]);
  });

  it('does nothing when the area already has that colour', () => {
    const d = blank();
    expect(floodFill(d, W, H, 2, 2, [255, 255, 255])).toBe(0);
  });

  it('stays inside the given rows', () => {
    const d = blank();
    const count = floodFill(d, W, H, 2, 5, [0, 0, 255], 40, { top: 3, bottom: 7 });
    expect(count).toBe(40);
    expect(pixel(d, 2, 2)).toEqual([255, 255, 255]);
    expect(pixel(d, 2, 7)).toEqual([255, 255, 255]);
    expect(pixel(d, 2, 3)).toEqual([0, 0, 255]);
  });

  it('ignores a start point outside the image', () => {
    const d = blank();
    expect(floodFill(d, W, H, -1, 4, [0, 0, 0])).toBe(0);
    expect(floodFill(d, W, H, 4, 12, [0, 0, 0])).toBe(0);
  });
});
