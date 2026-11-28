import { isGeneratedBoard } from './Puzzles';

async function buildHere(size: number): Promise<string[] | undefined> {
  const { generatePuzzle } = await import('./generatePuzzle');
  let rows: string[] | undefined;
  for (let attempt = 0; attempt < 5 && !rows; attempt++) rows = generatePuzzle(size);
  return rows;
}

/** Makes a fresh board on this device, in a worker where the browser has one. Works offline. */
export function buildPuzzle(size: number, signal: AbortSignal): Promise<string[] | undefined> {
  if (signal.aborted) return Promise.reject(new DOMException('Stopped', 'AbortError'));
  let worker: Worker;
  try {
    worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return buildHere(size);
  }
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', stop);
      worker.terminate();
    };
    const stop = () => {
      finish();
      reject(new DOMException('Stopped', 'AbortError'));
    };
    signal.addEventListener('abort', stop, { once: true });
    worker.onmessage = (event: MessageEvent<{ rows?: unknown }>) => {
      finish();
      const rows = event.data?.rows;
      resolve(isGeneratedBoard(rows) && rows.length === size ? rows : undefined);
    };
    worker.onerror = event => {
      event.preventDefault();
      finish();
      buildHere(size).then(resolve, reject);
    };
    worker.postMessage({ size });
  });
}
