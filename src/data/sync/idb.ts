/**
 * A ~60-line IndexedDB wrapper.
 *
 * The outbox must survive a refresh mid-flush, which rules out memory, and it
 * can hold hundreds of queued ops after an offline binge, which rules out
 * localStorage's synchronous 5MB budget. `idb` the package would do, but this
 * needs exactly four operations.
 */

const DB_NAME = 'shelf'
const DB_VERSION = 1
const STORE = 'outbox'
const DEAD = 'dead-letters'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        // Keyed by `key`, which is what makes coalescing a plain put().
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(DEAD)) {
        db.createObjectStore(DEAD, { keyPath: 'key' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const req = fn(transaction.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const idb = {
  put: <T>(value: T, store = STORE) => tx(store, 'readwrite', (s) => s.put(value as never)),
  delete: (key: string, store = STORE) => tx(store, 'readwrite', (s) => s.delete(key)),
  all: <T>(store = STORE) => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  clear: (store = STORE) => tx(store, 'readwrite', (s) => s.clear()),
  DEAD,
}

/** IndexedDB is unavailable in some private-browsing modes; degrade quietly. */
export const idbAvailable = typeof indexedDB !== 'undefined'
