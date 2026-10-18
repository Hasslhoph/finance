import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard.js'
import { api } from '../api/client.js'
import { formatRub } from '../lib/money.js'
import type { DashboardResponse } from '../api/types.js'

const emptyDashboard: DashboardResponse = {
  range: { from: '2026-10-01', to: '2026-10-18' },
  totals: { total: 0, available: 0, deposits: 0 },
  income: { sasha: 0, tanya: 0, interest: 0, total: 0 },
  expense: { total: 0 },
  saved: { amount: 0, ratio: null },
  byCategory: [],
  byGroup: [],
  accounts: [],
  history: [
    { from: '2026-05-01', to: '2026-05-31', income: 0, expense: 0, saved: 0 },
    { from: '2026-06-01', to: '2026-06-30', income: 0, expense: 0, saved: 0 },
    { from: '2026-07-01', to: '2026-07-31', income: 0, expense: 0, saved: 0 },
    { from: '2026-08-01', to: '2026-08-31', income: 0, expense: 0, saved: 0 },
    { from: '2026-09-01', to: '2026-09-30', income: 0, expense: 0, saved: 0 },
    { from: '2026-10-01', to: '2026-10-18', income: 0, expense: 0, saved: 0 },
  ],
  insights: [],
}

// Тонкий неразрывный пробел в вёрстке легко потерять при нормализации, поэтому
// ищем по регулярке, где любой пробельный символ совпадает с любым.
const rub = (kopecks: number): RegExp =>
  new RegExp(`^${formatRub(kopecks).replace(/[\s\u00a0\u202f]/g, '\\s')}$`)

function mockDashboard(partial: Partial<DashboardResponse> = {}) {
  const payload = { ...emptyDashboard, ...partial }
  vi.spyOn(api, 'get').mockResolvedValue(payload as never)
  return payload
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Dashboard', () => {
  it('показывает четыре главные цифры', async () => {
    mockDashboard({
      totals: { total: 60_000_000, available: 10_000_000, deposits: 50_000_000 },
      income: { sasha: 500_000, tanya: 300_000, interest: 12_345, total: 812_345 },
      expense: { total: 250_000 },
      saved: { amount: 5_500_000, ratio: 0.32 },
    })

    renderDashboard()

    expect(await screen.findByText(rub(60_000_000))).toBeInTheDocument()
    expect(screen.getByText(rub(10_000_000))).toBeInTheDocument()
    expect(screen.getByText(rub(5_500_000))).toBeInTheDocument()
    expect(screen.getByText(/32% от поступлений/)).toBeInTheDocument()
  })

  it('показывает проценты отдельной строкой', async () => {
    mockDashboard({ income: { sasha: 500_000, tanya: 300_000, interest: 12_345, total: 812_345 } })
    renderDashboard()

    expect(await screen.findByText(/Проценты по вкладам/)).toBeInTheDocument()
    expect(screen.getByText(rub(12_345))).toBeInTheDocument()
  })

  it('разделяет заработок по людям', async () => {
    mockDashboard({ income: { sasha: 500_000, tanya: 300_000, interest: 0, total: 800_000 } })
    renderDashboard()

    const earned = (await screen.findByText(/Заработано за период/)).closest('article')!
    expect(within(earned).getByText(/Саша/)).toBeInTheDocument()
    expect(within(earned).getByText(rub(500_000))).toBeInTheDocument()
    expect(within(earned).getByText(rub(300_000))).toBeInTheDocument()
  })

  it('показывает доли категорий', async () => {
    mockDashboard({
      expense: { total: 300_000 },
      byCategory: [
        { id: 1, name: 'Продукты', groupName: 'Еда', color: '#34D399', amount: 200_000, share: 0.666667 },
        { id: 2, name: 'Такси', groupName: 'Транспорт', color: '#FBBF24', amount: 100_000, share: 0.333333 },
      ],
    })
    renderDashboard()

    expect(await screen.findByText('Продукты')).toBeInTheDocument()
    expect(screen.getByText(rub(200_000))).toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('пустое состояние без единой операции', async () => {
    mockDashboard()
    renderDashboard()

    expect(await screen.findByText(/Пока нет операций/)).toBeInTheDocument()
  })

  it('подсказка объясняет перерасход словами', async () => {
    mockDashboard({
      insights: [
        { categoryId: 1, name: 'Кафе и рестораны', current: 300_000, baseline: 100_000, ratio: 3, excess: 200_000 },
      ],
    })
    renderDashboard()

    expect(await screen.findByText('Кафе и рестораны')).toBeInTheDocument()
    expect(screen.getByText(/в 3 раза больше обычного/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Обычно\\s${formatRub(100_000).replace(/[\s\u00a0\u202f]/g, '\\s')}`))).toBeInTheDocument()
  })

  it('показывает, что сравнивать пока не с чем', async () => {
    mockDashboard()
    renderDashboard()

    expect(await screen.findByText(/подсказки появятся/i)).toBeInTheDocument()
  })

  it('переключает период и запрашивает другой диапазон', async () => {
    const spy = mockDashboard()
    renderDashboard()

    await screen.findByText('Пока нет операций')
    await userEvent.click(screen.getByRole('button', { name: '3 месяца' }))

    expect(spy).toBeTruthy()
    expect(vi.mocked(api.get).mock.calls.at(-1)?.[1]).toEqual({ preset: '3m' })
  })

  it('показывает ошибку и повторяет запрос', async () => {
    const spy = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Сеть недоступна'))
    renderDashboard()

    expect(await screen.findByRole('alert')).toHaveTextContent('Сеть недоступна')

    spy.mockResolvedValue(emptyDashboard as never)
    await userEvent.click(screen.getByRole('button', { name: /Повторить/ }))

    expect(await screen.findByText(/Пока нет операций/)).toBeInTheDocument()
  })
})
