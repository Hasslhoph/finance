import type { Db } from '../db/database.js'
import type { DateRange } from '../types.js'

export interface Insight {
  categoryId: number
  name: string
  current: number
  baseline: number
  ratio: number
  excess: number
}

export interface InsightOptions {
  threshold?: number
  minExcess?: number
}

export function findOverspends(db: Db, range: DateRange, options: InsightOptions = {}): Insight[] {
  void db
  void range
  void options
  return []
}
