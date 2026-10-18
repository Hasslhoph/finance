import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QuickAdd } from './QuickAdd.js'
import { ApiError, api } from '../api/client.js'
import type { Account, Category } from '../api/types.js'

const INTEREST: Category = {
  id: 101,
  name: 'Проценты по вкладу',
  groupName: 'Доход',
  kind: 'income',
  color: '#4ADE80',
  icon: '🏦',
  slug: 'interest-income',
  archived: false,
  sortOrder: 100,
}

const CATEGORIES: Category[] = [
  {
    id: 1,
    name: 'Продукты',
    groupName: 'Еда',
    kind: 'expense',
    color: '#34D399',
    icon: '🛒',
    slug: null,
    archived: false,
    sortOrder: 1,
  },
  {
    id: 2,
    name: 'Такси',
    groupName: 'Транспорт',
    kind: 'expense',
    color: '#FBBF24',
    icon: '🚕',
    slug: null,
    archived: false,
    sortOrder: 2,
  },
]

const ACCOUNTS: Account[] = [
  {
    id: 7,
    name: 'Карта Саши',
    kind: 'card',
    owner: 'sasha',
    openingBalance: 0,
    openingDate: '2026-10-01',
    archived: false,
    sortOrder: 1,
    balance: 0,
  },
  {
    id: 8,
    name: 'Вклад Саши',
    kind: 'deposit',
    owner: 'sasha',
    openingBalance: 0,
    openingDate: '2026-10-01',
    archived: false,
    sortOrder: 4,
    balance: 0,
  },
]

function mockApi() {
  vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
    if (path === '/api/categories') return { items: [...CATEGORIES, INTEREST] } as never
    if (path === '/api/accounts') return { items: ACCOUNTS } as never
    throw new Error(`Неожиданный путь ${path}`)
  })
  return vi.spyOn(api, 'post').mockResolvedValue({ items: [] } as never)
}

async function addExpense({ amount, category }: { amount: string; category: string }) {
  await screen.findByRole('button', { name: new RegExp(category) })
  await userEvent.clear(screen.getByLabelText('Сумма'))
  await userEvent.type(screen.getByLabelText('Сумма'), amount)
  await userEvent.click(screen.getByRole('button', { name: new RegExp(category) }))
  await userEvent.click(screen.getByRole('button', { name: 'Добавить в список' }))
}

function renderQuickAdd() {
  return render(
    <MemoryRouter>
      <QuickAdd />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('QuickAdd', () => {
  it('сохраняет несколько трат одной отправкой', async () => {
    const post = mockApi()
    renderQuickAdd()

    await addExpense({ amount: '450', category: 'Продукты' })
    await addExpense({ amount: '1200', category: 'Такси' })
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить 2' }))

    expect(post).toHaveBeenCalledTimes(1)
    const [path, body] = post.mock.calls[0] as [string, { items: unknown[] }]
    expect(path).toBe('/api/transactions/batch')
    expect(body.items).toHaveLength(2)
  })

  it('передаёт сумму в копейках, категорию, счёт и дату', async () => {
    const post = mockApi()
    renderQuickAdd()

    await userEvent.selectOptions(await screen.findByLabelText('Счёт'), '7')
    await addExpense({ amount: '450,50', category: 'Продукты' })
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить 1' }))

    const [, body] = post.mock.calls[0] as [string, { items: Array<Record<string, unknown>> }]
    expect(body.items[0]).toMatchObject({
      kind: 'expense',
      amount: 45_050,
      categoryId: 1,
      accountId: 7,
      person: 'sasha',
    })
    expect(String(body.items[0].date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('после сохранения очищает форму и возвращает фокус в сумму', async () => {
    mockApi()
    renderQuickAdd()

    await addExpense({ amount: '450', category: 'Продукты' })
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить 1' }))

    expect(await screen.findByText(/Записано 1/)).toBeInTheDocument()
    expect(screen.getByLabelText('Сумма')).toHaveValue('')
    expect(document.activeElement).toBe(screen.getByLabelText('Сумма'))
    expect(screen.getByRole('button', { name: 'Сохранить 0' })).toBeDisabled()
  })

  it('дата по умолчанию — сегодня', async () => {
    mockApi()
    renderQuickAdd()
    await screen.findByRole('button', { name: /Продукты/ })
    // jsdom отдаёт valueAsDate, поэтому смотрим на value напрямую
    const input = screen.getByLabelText('Дата') as HTMLInputElement
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('запоминает последнюю категорию и счёт', async () => {
    mockApi()
    renderQuickAdd()

    await addExpense({ amount: '100', category: 'Продукты' })

    expect(screen.getByRole('button', { name: /Продукты/ })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('ff.lastCategory')).toBe('Продукты')
  })

  it('подставляет запомненную категорию при следующем открытии', async () => {
    localStorage.setItem('ff.lastCategory', 'Такси')
    mockApi()
    renderQuickAdd()

    expect(await screen.findByRole('button', { name: /Такси/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('показывает ошибку на кривую сумму и не добавляет запись', async () => {
    mockApi()
    renderQuickAdd()

    await userEvent.type(screen.getByLabelText('Сумма'), '12.5.6')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в список' }))

    expect(screen.getByText(/Неверная сумма/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сохранить 0' })).toBeDisabled()
  })

  it('переключатель человека сохраняется как поле записи', async () => {
    const post = mockApi()
    renderQuickAdd()

    await screen.findByRole('button', { name: 'Таня' })
    await userEvent.click(screen.getByRole('button', { name: 'Таня' }))
    await addExpense({ amount: '100', category: 'Продукты' })
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить 1' }))

    const [, body] = post.mock.calls[0] as [string, { items: Array<{ person: string }> }]
    expect(body.items[0].person).toBe('tanya')
  })

  it('запоминает человека для следующих записей подряд', async () => {
    mockApi()
    renderQuickAdd()

    await screen.findByRole('button', { name: 'Таня' })
    await userEvent.click(screen.getByRole('button', { name: 'Таня' }))
    await addExpense({ amount: '100', category: 'Продукты' })

    expect(screen.getByRole('button', { name: 'Таня' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('позволяет убрать запись из списка', async () => {
    mockApi()
    renderQuickAdd()

    await addExpense({ amount: '450', category: 'Продукты' })
    const item = screen.getByRole('listitem')
    await userEvent.click(within(item).getByRole('button', { name: /Убрать/ }))

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('сохраняет доход с категорией дохода', async () => {
    const post = mockApi()
    renderQuickAdd()

    await userEvent.click(await screen.findByRole('button', { name: 'Доход' }))
    await userEvent.type(screen.getByLabelText('Сумма'), '50000')
    await userEvent.click(await screen.findByRole('button', { name: /Проценты по вкладу/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в список' }))
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить 1' }))

    const [, body] = post.mock.calls[0] as [string, { items: Array<Record<string, unknown>> }]
    expect(body.items[0]).toMatchObject({ kind: 'income', amount: 5_000_000, categoryId: 101, person: 'sasha' })
  })

  it('в режиме дохода показывает только категории дохода', async () => {
    mockApi()
    renderQuickAdd()

    await userEvent.click(await screen.findByRole('button', { name: 'Доход' }))

    expect(await screen.findByRole('button', { name: /Проценты по вкладу/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Продукты/ })).not.toBeInTheDocument()
  })

  it('сохраняет перевод между счетами без категории', async () => {
    const post = mockApi()
    renderQuickAdd()

    await userEvent.click(await screen.findByRole('button', { name: 'Перевод' }))
    await userEvent.type(screen.getByLabelText('Сумма'), '10000')
    await userEvent.selectOptions(screen.getByLabelText('Со счёта'), '7')
    await userEvent.selectOptions(screen.getByLabelText('На счёт'), '8')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в список' }))
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить 1' }))

    const [, body] = post.mock.calls[0] as [string, { items: Array<Record<string, unknown>> }]
    expect(body.items[0]).toMatchObject({ kind: 'transfer', amount: 1_000_000, accountId: 7, transferAccountId: 8 })
    expect(body.items[0].categoryId).toBeUndefined()
  })

  it('перевод требует разные счета', async () => {
    mockApi()
    renderQuickAdd()

    await userEvent.click(await screen.findByRole('button', { name: 'Перевод' }))
    await userEvent.type(screen.getByLabelText('Сумма'), '10000')
    await userEvent.selectOptions(screen.getByLabelText('Со счёта'), '7')
    await userEvent.selectOptions(screen.getByLabelText('На счёт'), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в список' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/разные счета/i)
  })

  it('при ошибке сервера список записей не теряется', async () => {
    mockApi()
    vi.mocked(api.post).mockRejectedValueOnce(new ApiError('Неверная сумма', 400))
    renderQuickAdd()

    await addExpense({ amount: '450', category: 'Продукты' })
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить 1' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверная сумма')
    expect(screen.getByRole('button', { name: 'Сохранить 1' })).toBeEnabled()
  })
})
