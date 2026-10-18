import type { Db } from '../db/database.js'
import type { AccountKind, DateRange } from '../types.js'
import { allBalances } from './balances.js'
import { monthWindowsBack, todayInMoscow } from '../lib/period.js'
import { findOverspends, type Insight } from './insights.js'

export interface DashboardResponse {
  range: DateRange
  totals: { total: number; available: number; deposits: number }
  income: { sasha: number; tanya: number; interest: number; total: number }
  expense: { total: number }
  saved: { amount: number; ratio: number | null }
  byCategory: Array<{
    id: number
    name: string
    groupName: string
    color: string
    amount: number
    share: number
  }>
  byGroup: Array<{ name: string; color: string; amount: number; share: number }>
  accounts: Array<{ id: number; name: string; kind: AccountKind; owner: string; balance: number }>
  history: Array<{ from: string; to: string; income: number; expense: number; saved: number }>
  insights: Insight[]
}

interface CategoryRow {
  id: number
  name: string
  group_name: string
  color: string
  amount: number
}

interface GroupRow {
  group_name: string
  color: string
  amount: number
}

const INTEREST_SLUG = 'interest-income'

function sumIncomeByPerson(db: Db, range: DateRange): { sasha: number; tanya: number; interest: number; total: number } {
  const rows = db
    .prepare(
      `select t.person as person, c.slug as slug, sum(t.amount) as amount
       from transactions t
       left join categories c on c.id = t.category_id
       where t.kind = 'income' and t.date between @from and @to
       group by t.person, c.slug`,
    )
    .all({ from: range.from, to: range.to }) as Array<{ person: string | null; slug: string | null; amount: number }>

  const result = { sasha: 0, tanya: 0, interest: 0, total: 0 }

  for (const row of rows) {
    result.total += row.amount
    if (row.slug === INTEREST_SLUG) {
      result.interest += row.amount
    } else if (row.person === 'sasha') {
      result.sasha += row.amount
    } else if (row.person === 'tanya') {
      result.tanya += row.amount
    }
  }

  return result
}

function sumExpenses(db: Db, range: DateRange): number {
  const row = db
    .prepare(
      `select coalesce(sum(amount), 0) as total
       from transactions
       where kind = 'expense' and date between ? and ?`,
    )
    .get(range.from, range.to) as { total: number }
  return row.total
}

export function buildDashboard(db: Db, range: DateRange, now: Date = new Date()): DashboardResponse {
  const balances = allBalances(db, todayInMoscow(now))
  const total = balances.reduce((sum, account) => sum + account.balance, 0)
  const deposits = balances
    .filter((account) => account.kind === 'deposit')
    .reduce((sum, account) => sum + account.balance, 0)

  const income = sumIncomeByPerson(db, range)
  const expenseTotal = sumExpenses(db, range)
  const savedAmount = income.total - expenseTotal

  const categoryRows = db
    .prepare(
      `select c.id as id, c.name as name, c.group_name as group_name, c.color as color, sum(t.amount) as amount
       from transactions t
       join categories c on c.id = t.category_id
       where t.kind = 'expense' and t.date between @from and @to
       group by c.id
       order by amount desc`,
    )
    .all({ from: range.from, to: range.to }) as CategoryRow[]

  const groupRows = db
    .prepare(
      `select c.group_name as group_name, min(c.color) as color, sum(t.amount) as amount
       from transactions t
       join categories c on c.id = t.category_id
       where t.kind = 'expense' and t.date between @from and @to
       group by c.group_name
       order by amount desc`,
    )
    .all({ from: range.from, to: range.to }) as GroupRow[]

  const share = (amount: number): number =>
    expenseTotal > 0 ? Math.round((amount / expenseTotal) * 1e6) / 1e6 : 0

  const byCategory = categoryRows.map((row) => ({
    id: row.id,
    name: row.name,
    groupName: row.group_name,
    color: row.color,
    amount: row.amount,
    share: share(row.amount),
  }))

  const byGroup = groupRows.map((row) => ({
    name: row.group_name,
    color: row.color,
    amount: row.amount,
    share: share(row.amount),
  }))

  const history = monthWindowsBack(now, 6).map((window) => {
    const windowIncome = sumIncomeByPerson(db, window).total
    const windowExpense = sumExpenses(db, window)
    return {
      from: window.from,
      to: window.to,
      income: windowIncome,
      expense: windowExpense,
      saved: windowIncome - windowExpense,
    }
  })

  return {
    range,
    totals: { total, available: total - deposits, deposits },
    income,
    expense: { total: expenseTotal },
    saved: {
      amount: savedAmount,
      ratio: income.total > 0 ? Math.round((savedAmount / income.total) * 100) / 100 : null,
    },
    byCategory,
    byGroup,
    accounts: balances,
    history,
    insights: findOverspends(db, range),
  }
}
