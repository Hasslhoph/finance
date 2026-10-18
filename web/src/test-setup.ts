import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  clear(): void {
    this.data.clear()
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

// В этом окружении localStorage может отсутствовать или быть несовместимым.
if (typeof globalThis.localStorage?.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  })
}

type MediaListener = (event: { matches: boolean }) => void

const listeners = new Set<MediaListener>()

function matchesQuery(query: string): boolean {
  const width = window.innerWidth
  if (query.includes('max-width: 767px')) return width <= 767
  if (query.includes('min-width: 768px')) return width >= 768
  return false
}

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return matchesQuery(query)
    },
    onchange: null,
    addEventListener: (_type: string, listener: MediaListener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: MediaListener) => {
      listeners.delete(listener)
    },
    addListener: (listener: MediaListener) => listeners.add(listener),
    removeListener: (listener: MediaListener) => listeners.delete(listener),
    dispatchEvent: () => true,
  })) as typeof window.matchMedia
}

export function setViewportWidth(width: number): void {
  window.innerWidth = width
  for (const listener of listeners) {
    listener({ matches: true })
  }
}

Object.defineProperty(globalThis, '__setViewportWidth', { value: setViewportWidth, configurable: true })

beforeEach(() => {
  localStorage.clear()
  setViewportWidth(1280)
})
