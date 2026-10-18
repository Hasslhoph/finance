export type Person = 'sasha' | 'tanya'
export type AccountKind = 'card' | 'cash' | 'deposit'
export type TransactionKind = 'expense' | 'income' | 'transfer'
export type CategoryKind = 'expense' | 'income'

export interface Account {
  id: number
  name: string
  kind: AccountKind
  owner: string
  openingBalance: number
  openingDate: string
  archived: boolean
  sortOrder: number
  balance?: number
}

export interface Category {
  id: number
  name: string
  groupName: string
  kind: CategoryKind
  color: string
  icon: string | null
  slug: string | null
  archived: boolean
  sortOrder: number
}

export interface Transaction {
  id: number
  kind: TransactionKind
  date: string
  amount: number
  accountId: number
  transferAccountId: number | null
  categoryId: number | null
  person: Person | null
  comment: string
}

export interface Insight {
  categoryId: number
  name: string
  current: number
  baseline: number
  ratio: number
  excess: number
}

export interface DashboardResponse {
  range: { from: string; to: string }
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
