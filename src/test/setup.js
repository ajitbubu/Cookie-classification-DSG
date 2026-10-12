import '@testing-library/jest-dom';

// Node 25 ships its own global `localStorage` with no working methods unless it
// is given a backing file, and it shadows jsdom's. Give tests a working one.
if (typeof globalThis.localStorage?.getItem !== 'function') {
  class MemoryStorage {
    #data = new Map();
    get length() { return this.#data.size; }
    key(i) { return [...this.#data.keys()][i] ?? null; }
    getItem(k) { return this.#data.has(String(k)) ? this.#data.get(String(k)) : null; }
    setItem(k, v) { this.#data.set(String(k), String(v)); }
    removeItem(k) { this.#data.delete(String(k)); }
    clear() { this.#data.clear(); }
  }
  Object.setPrototypeOf(MemoryStorage.prototype, globalThis.Storage?.prototype ?? Object.prototype);
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
}
