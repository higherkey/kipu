export type GameFeedbackDraft = {
  gameId: string;
  gameName: string;
  text: string;
  audio?: Blob;
};

export type GameFeedbackEntry = GameFeedbackDraft & {
  id: number;
  createdAt: number;
};

const STORE_NAME = 'feedback';
const MAX_TEXT_LENGTH = 500;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/aac', 'audio/mpeg', 'audio/x-m4a']);

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Local feedback storage is unavailable.'));
      return;
    }

    const request = indexedDB.open('kipu-game-feedback', 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Local feedback storage is busy.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Local feedback storage failed.'));
    });
  } finally {
    database.close();
  }
}

export async function saveGameFeedback({ gameId, gameName, text, audio }: GameFeedbackDraft): Promise<void> {
  const note = text.trim();
  if (note.length > MAX_TEXT_LENGTH) {
    throw new Error('Feedback must be 500 characters or fewer.');
  }
  if (audio !== undefined && (
    !(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES ||
    !AUDIO_TYPES.has(audio.type.split(';', 1)[0].trim())
  )) {
    throw new Error('Feedback audio must be a supported recording of 5 MiB or less.');
  }
  if (!note && audio === undefined) {
    throw new Error('Add a note or a recording.');
  }

  await runTransaction('readwrite', (store) => store.add({
    gameId, gameName, text: note, audio, createdAt: Date.now(),
  }));
}

export async function listGameFeedback(): Promise<GameFeedbackEntry[]> {
  const entries = await runTransaction<GameFeedbackEntry[]>('readonly', (store) => store.getAll());
  return entries.sort((first, second) => second.createdAt - first.createdAt || second.id - first.id);
}

export async function deleteGameFeedback(id: number): Promise<void> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Feedback ID must be a positive integer.');
  }

  await runTransaction('readwrite', (store) => store.delete(id));
}
