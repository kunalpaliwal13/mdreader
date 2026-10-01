// "Open folder on disk" (File System Access API, Chromium only). The picked folder's handle is remembered in IndexedDB
// so it can be reopened after a reload (the browser may ask for permission again).
type Dir = FileSystemDirectoryHandle & {
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
};

export const canOpenFolder = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

function store<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('mdreader', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
      tx.onerror = () => reject(tx.error);
    };
  });
}

export const rememberedFolder = () => store<Dir>('readonly', (s) => s.get('folder')).catch(() => undefined);
export const rememberFolder = (h: FileSystemDirectoryHandle) => store('readwrite', (s) => void s.put(h, 'folder'));

export async function pickFolder(): Promise<Dir | null> {
  try {
    return await (window as unknown as { showDirectoryPicker(o: object): Promise<Dir> }).showDirectoryPicker({ mode: 'readwrite', id: 'mdreader' });
  } catch {
    return null; // cancelled
  }
}

export const hasAccess = async (h: Dir, ask: boolean) =>
  (await h.queryPermission({ mode: 'readwrite' })) === 'granted' || (ask && (await h.requestPermission({ mode: 'readwrite' })) === 'granted');

export type { Dir };
