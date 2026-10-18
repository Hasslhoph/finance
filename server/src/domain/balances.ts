import type { Db } from '../db/database.js'
import type { AccountKind } from '../types.js'
import { todayInMoscow } from '../lib/period.js'

export interface AccountBalance {
  id: number
  name: string
  kind: AccountKind
  owner: string
  balance: number
}

interface BalanceRow extends AccountBalance {
  archived: number
}

const BALANCE_SQL = `
  select
    a.id,
    a.name,
    a.kind,
    a.owner,
    a.archived,
    case when a.opening_date <= @asOf then a.opening_balance else 0 end
    + coalesce((
      select sum(
        case
          when t.kind = 'income' and t.account_id = a.id then t.amount
          when t.kind = 'expense' and t.account_id = a.id then -t.amount
          when t.kind = 'transfer' and t.account_id = a.id then -t.amount
          when t.kind = 'transfer' and t.transfer_account_id = a.id then t.amount
          else 0
        end
      )
      from transactions t
      where t.date <= @asOf and (t.account_id = a.id or t.transfer_account_id = a.id)
    ), 0) as balance
  from accounts a
`

export function accountBalance(db: Db, accountId: number, asOf: string = todayInMoscow()): number {
  const row = db
    .prepare(`${BALANCE_SQL} where a.id = @id`)
    .get({ id: accountId, asOf }) as BalanceRow | undefined
  return row ? row.balance : 0
}

export function allBalances(db: Db, asOf: string = todayInMoscow()): AccountBalance[] {
  const rows = db
    .prepare(`${BALANCE_SQL} where a.archived = 0 order by a.sort_order, a.id`)
    .all({ asOf }) as BalanceRow[]

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    owner: row.owner,
    balance: row.balance,
  }))
}
