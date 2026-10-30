/** Tiny IndexedDB cache for static map data (settlements, POI). Bump VERSION after data imports. */
const VERSION = "v1";
const DB = "summit-static";

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((res) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await open(); if (!db) return null;
  return new Promise((res) => {
    const q = db.transaction("kv").objectStore("kv").get(`${VERSION}:${key}`);
    q.onsuccess = () => res((q.result as T) ?? null);
    q.onerror = () => res(null);
  });
}

export async function cacheSet(key: string, value: unknown) {
  const db = await open(); if (!db) return;
  try { db.transaction("kv", "readwrite").objectStore("kv").put(value, `${VERSION}:${key}`); } catch { /* ignore quota */ }
}

export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit) return hit;
  const fresh = await load();
  await cacheSet(key, fresh);
  return fresh;
}
