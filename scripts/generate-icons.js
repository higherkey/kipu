import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.resolve(__dirname, '../public/favicon.svg');
const publicDir = path.resolve(__dirname, '../public');

async function generate() {
  const sizes = [192, 512];
  for (const size of sizes) {
    const dest = path.resolve(publicDir, `pwa-${size}x${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(dest);
    console.log(`Generated pwa-${size}x${size}.png`);
  }
}

try {
  await generate();
} catch (error) {
  console.error('Error generating icons:', error);
  process.exit(1);
}
