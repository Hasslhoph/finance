import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Transactions } from './Transactions.js'
import { api } from '../api/client.js'
import type { Account, Category, Transaction } from '../api/types.js'

const CATEGORIES: Category[] = [
  { id: 1, name: 'Продукты', groupName: 'Еда', kind: 'expense', color: '#34D399', icon: '🛒', slug: null, archived: false, sortOrder: 1 },
  { id: 2, name: 'Такси', groupName: 'Транспорт', kind: 'expense', color: '#FBBF24', icon: '🚕', slug: null, archived: false, sortOrder: 2 },
  { id: 3, name: 'Старая категория', groupName: 'Прочее', kind: 'expense', color: '#64748B', icon: '📌', slug: null, archived: true, sortOrder: 3 },
]

const ACCOUNTS: Account[] = [
  { id: 7, name: 'Карта Саши', kind: 'card', owner: 'sasha', openingBalance: 0, openingDate: '2026-10-01', archived: false, sortOrder: 1 },
  { id: 8, name: 'Вклад Саши', kind: 'deposit', owner: 'sasha', openingBalance: 0, openingDate: '2026-10-01', archived: false, sortOrder: 4 },
]

const TRANSACTIONS: Transaction[] = [
  { id: 11, kind: 'expense', date: '2026-10-18', amount: 45_000, accountId: 7, transferAccountId: null, categoryId: 1, person: 'sasha', comment: 'Пятёрочка' },
  { id: 12, kind: 'expense', date: '2026-10-18', amount: 120_000, accountId: 7, transferAccountId: null, categoryId: 2, person: 'sasha', comment: '' },
  { id: 13, kind: 'transfer', date: '2026-10-17', amount: 1_000_000, accountId: 7, transferAccountId: 8, categoryId: null, person: null, comment: 'На вклад' },
  { id: 14, kind: 'expense', date: '2026-10-16', amount: 5_000, accountId: 7, transferAccountId: null, categoryId: 3, person: 'tanya', comment: 'Старое' },
]

function mockApi(transactions = TRANSACTIONS) {
  vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
    if (path === '/api/categories') return { items: CATEGORIES } as never
    if (path === '/api/accounts') return { items: ACCOUNTS } as never
    if (path === '/api/transactions') return { items: transactions, total: transactions.length } as never
    throw new Error(`Неожиданный путь ${path}`)
  })
  const del = vi.spyOn(api, 'del').mockResolvedValue(undefined as never)
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ item: TRANSACTIONS[0] } as never)
  return { del, patch }
}

function renderTransactions() {
  return render(
    <MemoryRouter>
      <Transactions />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Transactions', () => {
  it('группирует операции по дням и показывает итог дня', async () => {
    mockApi()
    renderTransactions()

    expect(await screen.findByText(/18 октября/)).toBeInTheDocument()
    expect(screen.getByText('−1 650 ₽')).toBeInTheDocument()
  })

  it('перевод подписан как перевод, а не расход', async () => {
    mockApi()
    renderTransactions()

    expect(await screen.findByText('Перевод → Вклад Саши')).toBeInTheDocument()
    expect(screen.getByText(/На вклад/)).toBeInTheDocument()
  })

  it('показывает комментарий и кто потратил', async () => {
    mockApi()
    renderTransactions()

    expect(await screen.findByText(/Пятёрочка/)).toBeInTheDocument()
    expect(screen.getAllByText('Саша').length).toBeGreaterThan(0)
  })

  it('архивная категория отображается в старых операциях', async () => {
    mockApi()
    renderTransactions()

    expect(await screen.findByText('Старая категория')).toBeInTheDocument()
  })

  it('удаление просит подтверждение и удаляет после согласия', async () => {
    const { del } = mockApi()
    renderTransactions()

    await screen.findByText(/Пятёрочка/)
    await userEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0])

    expect(screen.getByRole('dialog')).toHaveTextContent(/Удалить операцию/)
    await userEvent.click(screen.getByRole('button', { name: 'Удалить навсегда' }))

    expect(del).toHaveBeenCalledWith('/api/transactions/11')
  })

  it('правка суммы отправляет PATCH', async () => {
    const { patch } = mockApi()
    renderTransactions()

    await screen.findByText(/Пятёрочка/)
    await userEvent.click(screen.getAllByRole('button', { name: 'Изменить' })[0])

    const amountField = screen.getByLabelText('Сумма')
    await userEvent.clear(amountField)
    await userEvent.type(amountField, '500')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(patch).toHaveBeenCalledWith('/api/transactions/11', expect.objectContaining({ amount: 50_000 }))
  })

  it('пустое состояние, когда операций нет', async () => {
    mockApi([])
    renderTransactions()

    expect(await screen.findByText(/Операций за этот период нет/)).toBeInTheDocument()
  })

  it('фильтр по человеку уходит в запрос', async () => {
    mockApi()
    renderTransactions()

    await screen.findByText(/Пятёрочка/)
    await userEvent.selectOptions(screen.getByLabelText('Кто'), 'tanya')

    const calls = vi.mocked(api.get).mock.calls.filter((call) => call[0] === '/api/transactions')
    expect(calls.at(-1)?.[1]).toMatchObject({ person: 'tanya' })
  })
})
