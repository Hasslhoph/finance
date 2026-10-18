export type Person = 'sasha' | 'tanya'
export type AccountKind = 'card' | 'cash' | 'deposit'
export type TransactionKind = 'expense' | 'income' | 'transfer'
export type CategoryKind = 'expense' | 'income'

export interface DateRange {
  from: string
  to: string
}
