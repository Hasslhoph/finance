import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Accounts } from './Accounts.js'
import { api } from '../api/client.js'
import { formatRub } from '../lib/money.js'
import type { Account } from '../api/types.js'

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
    balance: 100_000,
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
    balance: 500_000,
  },
]

function mockApi() {
  vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
    if (path === '/api/accounts') return { items: ACCOUNTS } as never
    if (path.endsWith('/checks')) return { items: [] } as never
    throw new Error(`Неожиданный путь ${path}`)
  })
  return vi.spyOn(api, 'post').mockResolvedValue({ computed: 100_000, actual: 95_000, diff: -5_000, correctionId: 1 } as never)
}

function renderAccounts() {
  return render(
    <MemoryRouter>
      <Accounts />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Accounts', () => {
  it('показывает счета с балансами и видами', async () => {
    mockApi()
    renderAccounts()

    expect(await screen.findByText('Карта Саши')).toBeInTheDocument()
    expect(screen.getByText('1 000 ₽')).toBeInTheDocument()
    expect(screen.getByText('5 000 ₽')).toBeInTheDocument()
    expect(screen.getAllByText('Вклад').length).toBeGreaterThan(0)
  })

  it('сверка показывает расхождение до сохранения', async () => {
    mockApi()
    renderAccounts()

    await screen.findByText('Карта Саши')
    await userEvent.click(screen.getAllByRole('button', { name: 'Сверить' })[0])
    await userEvent.type(screen.getByLabelText('Фактический остаток'), '950')

    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          (element.textContent ?? '').includes(`Расхождение ${formatRub(-5_000)}`),
      ),
    ).toBeInTheDocument()
  })

  it('записывает сверку и показывает подтверждение', async () => {
    const post = mockApi()
    renderAccounts()

    await screen.findByText('Карта Саши')
    await userEvent.click(screen.getAllByRole('button', { name: 'Сверить' })[0])
    await userEvent.type(screen.getByLabelText('Фактический остаток'), '950')
    await userEvent.click(screen.getByRole('button', { name: 'Записать сверку' }))

    expect(post).toHaveBeenCalledWith('/api/accounts/7/check', expect.objectContaining({ actualBalance: 95_000 }))
    expect(await screen.findByRole('status')).toHaveTextContent(/Нераспознанное/)
  })

  it('добавляет новый счёт', async () => {
    const post = mockApi()
    renderAccounts()

    await screen.findByText('Карта Саши')
    await userEvent.type(screen.getByLabelText('Название счёта'), 'Наличные')
    await userEvent.selectOptions(screen.getByLabelText(/Вид/), 'cash')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить счёт' }))

    expect(post).toHaveBeenCalledWith('/api/accounts', expect.objectContaining({ name: 'Наличные', kind: 'cash' }))
  })
})
