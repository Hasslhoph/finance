import { beforeEach, describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { api } from './api/client.js'
import type { Account, Category } from './api/types.js'
import { renderApp, setViewport } from './test-utils.js'

const CATEGORIES: Category[] = [
  { id: 1, name: 'Продукты', groupName: 'Еда', kind: 'expense', color: '#34D399', icon: '🛒', slug: null, archived: false, sortOrder: 1 },
  { id: 101, name: 'Проценты по вкладу', groupName: 'Доход', kind: 'income', color: '#4ADE80', icon: '🏦', slug: 'interest-income', archived: false, sortOrder: 2 },
]

const ACCOUNTS: Account[] = [
  { id: 7, name: 'Карта Саши', kind: 'card', owner: 'sasha', openingBalance: 0, openingDate: '2026-10-01', archived: false, sortOrder: 1, balance: 100_000 },
]

const DASHBOARD = {
  range: { from: '2026-10-01', to: '2026-10-18' },
  totals: { total: 100_000, available: 100_000, deposits: 0 },
  income: { sasha: 0, tanya: 0, interest: 0, total: 0 },
  expense: { total: 0 },
  saved: { amount: 0, ratio: null },
  byCategory: [],
  byGroup: [],
  accounts: [],
  history: [],
  insights: [],
}

function mockApi() {
  vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
    switch (path) {
      case '/api/auth/me':
        return { authenticated: true } as never
      case '/api/dashboard':
        return DASHBOARD as never
      case '/api/transactions':
        return { items: [], total: 0 } as never
      case '/api/accounts':
        return { items: ACCOUNTS } as never
      case '/api/categories':
        return { items: CATEGORIES } as never
      default:
        if (path.endsWith('/checks')) return { items: [] } as never
        throw new Error(`Неожиданный путь ${path}`)
    }
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  mockApi()
})

describe('App', () => {
  it('все экраны рендерятся без ошибок', async () => {
    for (const route of ['/', '/transactions', '/add', '/accounts', '/categories', '/settings']) {
      const { unmount } = renderApp(route)
      // ждём окончания проверки входа, иначе попадём на скелетон
      await screen.findByRole('navigation', { name: 'Основная' })
      expect(screen.getByRole('main')).toBeInTheDocument()
      unmount()
    }
  })

  it('на большом экране видна верхняя навигация с настройками', async () => {
    setViewport(1280)
    renderApp('/')

    const nav = await screen.findByRole('navigation', { name: 'Основная' })
    expect(within(nav).getByText('Настройки')).toBeInTheDocument()
  })

  it('на мобильном видна нижняя навигация и добавление в центре', async () => {
    setViewport(360)
    renderApp('/')

    const nav = await screen.findByRole('navigation', { name: 'Основная' })
    expect(within(nav).getByText('Добавить')).toBeInTheDocument()
  })

  it('на неизвестном пути показывает обзор', async () => {
    renderApp('/nope')
    expect(await screen.findByRole('heading', { name: 'Обзор' })).toBeInTheDocument()
  })
})
