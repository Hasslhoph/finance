export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const UNAUTHORIZED_EVENT = 'ff:unauthorized'
export const AUTHORIZED_EVENT = 'ff:authorized'

type Query = Record<string, string | number | boolean | undefined | null>

function buildUrl(path: string, query?: Query): string {
  if (!query) {
    return path
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    params.set(key, String(value))
  }

  const search = params.toString()
  return search ? `${path}?${search}` : path
}

function handleUnauthorized(): void {
  if (typeof window === 'undefined') {
    return
  }
  if (window.location.pathname !== '/login') {
    window.history.replaceState(null, '', '/login')
  }
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new ApiError('Требуется вход', 401)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new ApiError(data.error ?? 'Что-то пошло не так', response.status)
  }

  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
