interface SaveData<T> {
  state: T;
  savedAt: number;
}

export interface LoadedSave<T> {
  state: T;
  elapsedSeconds: number;
}

export function saveState<T>(storage: Storage, key: string, state: T, now = Date.now()) {
  const data: SaveData<T> = { state, savedAt: now };
  storage.setItem(key, JSON.stringify(data));
}

export function loadState<T>(storage: Storage, key: string, now = Date.now()): LoadedSave<T> | null {
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const { state, savedAt } = JSON.parse(raw) as SaveData<T>;
    return { state, elapsedSeconds: Math.max(0, now - savedAt) / 1000 };
  } catch {
    return null;
  }
}
