import '@testing-library/jest-dom';

/* ── localStorage polyfill for Node 25+ ─────────────── */
/* Node 25 ships a built-in localStorage that shadows jsdom's.
   The built-in version requires --localstorage-file and doesn't
   expose standard methods. We replace it with an in-memory mock. */
(() => {
  const store = new Map<string, string>();
  const mock: Storage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(key: string) { return store.get(key) ?? null; },
    key(index: number) { return [...store.keys()][index] ?? null; },
    removeItem(key: string) { store.delete(key); },
    setItem(key: string, value: string) { store.set(key, String(value)); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true, configurable: true });
})();
