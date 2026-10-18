import { describe, it, expect } from 'vitest'
import { archiveCategory, createCategory, getCategoryBySlug, listCategories, updateCategory } from './categories.js'
import { createTestDb } from '../../test/helpers.js'

describe('categories', () => {
  it('не даёт переименовать служебную категорию в другую роль', () => {
    const db = createTestDb()
    const interest = getCategoryBySlug(db, 'interest-income')!
    expect(() => updateCategory(db, interest.id, { kind: 'expense' })).toThrow(/служебн/i)
  })

  it('не даёт удалить служебную категорию', () => {
    const db = createTestDb()
    const interest = getCategoryBySlug(db, 'interest-income')!
    expect(() => archiveCategory(db, interest.id)).toThrow(/служебн/i)
  })

  it('служебную категорию можно перекрасить и переименовать', () => {
    const db = createTestDb()
    const interest = getCategoryBySlug(db, 'interest-income')!
    const updated = updateCategory(db, interest.id, { name: 'Проценты', color: '#123456' })
    expect(updated.name).toBe('Проценты')
    expect(updated.color).toBe('#123456')
    expect(updated.slug).toBe('interest-income')
  })

  it('архивная категория не попадает в список для формы', () => {
    const db = createTestDb()
    const category = createCategory(db, {
      name: 'Тест',
      groupName: 'Прочее',
      kind: 'expense',
      color: '#888888',
    })
    archiveCategory(db, category.id)
    expect(listCategories(db, { kind: 'expense' }).some((item) => item.id === category.id)).toBe(false)
  })

  it('архивная категория остаётся доступной вместе с архивными', () => {
    const db = createTestDb()
    const category = createCategory(db, {
      name: 'Тест',
      groupName: 'Прочее',
      kind: 'expense',
      color: '#888888',
    })
    archiveCategory(db, category.id)
    expect(listCategories(db, { includeArchived: true }).some((item) => item.id === category.id)).toBe(true)
  })

  it('сид содержит все группы расходов', () => {
    const db = createTestDb()
    expect(listCategories(db, { kind: 'expense' }).map((item) => item.groupName)).toEqual(
      expect.arrayContaining([
        'Дом',
        'Еда',
        'Транспорт',
        'Подписки и сервисы',
        'Здоровье',
        'Покупки',
        'Прочее',
      ]),
    )
  })

  it('в доходах есть защищённые проценты', () => {
    const db = createTestDb()
    expect(listCategories(db, { kind: 'income' }).some((item) => item.slug === 'interest-income')).toBe(true)
  })

  it('отвергает пустое имя и неизвестный вид', () => {
    const db = createTestDb()
    expect(() =>
      createCategory(db, { name: '  ', groupName: 'Прочее', kind: 'expense', color: '#fff' }),
    ).toThrow(/назван/i)
    expect(() =>
      createCategory(db, {
        name: 'Тест',
        groupName: 'Прочее',
        kind: 'nope' as never,
        color: '#fff',
      }),
    ).toThrow(/вид/i)
  })
})
