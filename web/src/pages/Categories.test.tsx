import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Categories } from './Categories.js'
import { api } from '../api/client.js'
import type { Category } from '../api/types.js'

const CATEGORIES: Category[] = [
  { id: 1, name: 'Продукты', groupName: 'Еда', kind: 'expense', color: '#34D399', icon: '🛒', slug: null, archived: false, sortOrder: 1 },
  { id: 101, name: 'Проценты по вкладу', groupName: 'Доход', kind: 'income', color: '#4ADE80', icon: '🏦', slug: 'interest-income', archived: false, sortOrder: 2 },
]

function mockApi() {
  vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
    if (path === '/api/categories') return { items: CATEGORIES } as never
    throw new Error(`Неожиданный путь ${path}`)
  })
  const post = vi.spyOn(api, 'post').mockResolvedValue({ item: CATEGORIES[0] } as never)
  const del = vi.spyOn(api, 'del').mockResolvedValue(undefined as never)
  return { post, del }
}

function renderCategories() {
  return render(
    <MemoryRouter>
      <Categories />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Categories', () => {
  it('группирует категории и показывает их', async () => {
    mockApi()
    renderCategories()

    expect(await screen.findByText('Продукты')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Еда' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Доход' })).toBeInTheDocument()
  })

  it('служебная категория не удаляется', async () => {
    mockApi()
    renderCategories()

    const interest = (await screen.findByText('Проценты по вкладу')).closest('[data-category]')!
    expect(within(interest as HTMLElement).getByRole('button', { name: 'Удалить' })).toBeDisabled()
  })

  it('обычную категорию можно удалить', async () => {
    const { del } = mockApi()
    renderCategories()

    const food = (await screen.findByText('Продукты')).closest('[data-category]')!
    await userEvent.click(within(food as HTMLElement).getByRole('button', { name: 'Удалить' }))

    expect(del).toHaveBeenCalledWith('/api/categories/1')
  })

  it('добавляет новую категорию', async () => {
    const { post } = mockApi()
    renderCategories()

    await screen.findByText('Продукты')
    await userEvent.type(screen.getByLabelText('Название категории'), 'Шаурма')
    await userEvent.type(screen.getByLabelText('Группа'), 'Еда')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить категорию' }))

    expect(post).toHaveBeenCalledWith(
      '/api/categories',
      expect.objectContaining({ name: 'Шаурма', groupName: 'Еда', kind: 'expense' }),
    )
  })
})
