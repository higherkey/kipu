/**
 * Scanline flood fill for Maka's paint bucket.
 *
 * Works on raw RGBA pixel data so it can be unit tested without a canvas.
 * Pixels count as part of the region when every channel is within `tolerance`
 * of the seed pixel. After the region is found, it grows by one pixel into
 * nearby in-between shades, so the soft, anti-aliased edge of a painted line
 * does not leave a pale halo, while solid lines stay untouched.
 */
export interface FillBounds {
  top: number;
  bottom: number; // exclusive
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  rgb: [number, number, number],
  tolerance = 40,
  bounds: FillBounds = { top: 0, bottom: height }
): number {
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  const top = Math.max(0, Math.floor(bounds.top));
  const bottom = Math.min(height, Math.floor(bounds.bottom));
  if (sx < 0 || sx >= width || sy < top || sy >= bottom) return 0;

  const seed = (sy * width + sx) * 4;
  const r0 = data[seed];
  const g0 = data[seed + 1];
  const b0 = data[seed + 2];

  // Filling a region with the colour it already has changes nothing
  if (
    Math.abs(r0 - rgb[0]) <= 2 &&
    Math.abs(g0 - rgb[1]) <= 2 &&
    Math.abs(b0 - rgb[2]) <= 2
  ) {
    return 0;
  }

  const matches = (p: number): boolean => {
    const i = p * 4;
    return (
      Math.abs(data[i] - r0) <= tolerance &&
      Math.abs(data[i + 1] - g0) <= tolerance &&
      Math.abs(data[i + 2] - b0) <= tolerance
    );
  };

  // Edge pixels a little further from the seed colour are blends, not lines
  const rimTolerance = Math.min(255, tolerance * 3.5);
  const nearSeed = (p: number): boolean => {
    const i = p * 4;
    return (
      Math.abs(data[i] - r0) <= rimTolerance &&
      Math.abs(data[i + 1] - g0) <= rimTolerance &&
      Math.abs(data[i + 2] - b0) <= rimTolerance
    );
  };

  const filled = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];
  let count = 0;

  while (stack.length > 0) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    const row = y * width;

    // Walk left to the start of this run
    while (x > 0 && !filled[row + x - 1] && matches(row + x - 1)) x--;

    let spanAbove = false;
    let spanBelow = false;
    while (x < width && !filled[row + x] && matches(row + x)) {
      filled[row + x] = 1;
      count++;

      if (y - 1 >= top) {
        const up = row - width + x;
        const ok = !filled[up] && matches(up);
        if (ok && !spanAbove) {
          stack.push(x, y - 1);
          spanAbove = true;
        } else if (!ok) {
          spanAbove = false;
        }
      }
      if (y + 1 < bottom) {
        const down = row + width + x;
        const ok = !filled[down] && matches(down);
        if (ok && !spanBelow) {
          stack.push(x, y + 1);
          spanBelow = true;
        } else if (!ok) {
          spanBelow = false;
        }
      }
      x++;
    }
  }

  // Paint the region, plus a one pixel rim of blended edge pixels
  for (let y = top; y < bottom; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const p = row + x;
      const inside =
        filled[p] === 1 ||
        (((x > 0 && filled[p - 1] === 1) ||
          (x < width - 1 && filled[p + 1] === 1) ||
          (y > top && filled[p - width] === 1) ||
          (y < bottom - 1 && filled[p + width] === 1)) &&
          nearSeed(p));
      if (!inside) continue;
      const i = p * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }

  return count;
}
