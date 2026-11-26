import { isGeneratedBoard, puzzleKey } from './Puzzles';

type SavedPuzzle = { id: number; rows: string[] };
const STORE = 'puzzles';

export function openPuzzleLibrary(signal: AbortSignal): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kipu-cat-quarters', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      store.createIndex('board', 'board', { unique: true });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (signal.aborted) {
        db.close();
        reject(new DOMException('Game closed', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => db.close(), { once: true });
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function readSavedPuzzles(db: IDBDatabase): Promise<SavedPuzzle[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.filter(puzzle =>
      Number.isSafeInteger(puzzle?.id) && puzzle.id > 0 && isGeneratedBoard(puzzle.rows)));
  });
}

export function savePuzzle(db: IDBDatabase, rows: string[]): Promise<SavedPuzzle | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const request = transaction.objectStore(STORE).add({ board: puzzleKey(rows), rows });
    transaction.onabort = () => {
      if (transaction.error?.name === 'ConstraintError') resolve(undefined);
      else reject(transaction.error);
    };
    transaction.oncomplete = () => resolve({ id: Number(request.result), rows });
  });
}
