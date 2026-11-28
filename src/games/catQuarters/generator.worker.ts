import { generatePuzzle } from './generatePuzzle';

// Builds boards off the main thread so big ones don't freeze the page.
self.onmessage = (event: MessageEvent<{ size: number }>) => {
  let rows: string[] | undefined;
  for (let attempt = 0; attempt < 5 && !rows; attempt++) rows = generatePuzzle(event.data.size);
  self.postMessage({ rows });
};
