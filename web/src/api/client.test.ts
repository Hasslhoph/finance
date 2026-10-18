import { beforeEach, describe, it, expect, vi } from 'vitest'
import { ApiError, api } from './client.js'

beforeEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('api', () => {
  it('401 перенаправляет на /login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"Требуется вход"}', { status: 401 })))

    await expect(api.get('/api/dashboard')).rejects.toThrow(ApiError)
    expect(window.location.pathname).toBe('/login')
  })

  it('400 отдаёт человеческое сообщение', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Неверная сумма' }), { status: 400 })),
    )

    await expect(api.post('/api/transactions', {})).rejects.toThrow('Неверная сумма')
  })

  it('204 не пытается разобрать тело', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(api.post('/api/auth/login', {})).resolves.toBeUndefined()
  })

  it('добавляет параметры к запросу и убирает пустые', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/api/dashboard', { preset: '3m', from: undefined, to: null })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/dashboard?preset=3m')
  })
})
