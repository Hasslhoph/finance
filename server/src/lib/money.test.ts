import { describe, it, expect } from 'vitest'
import { parseAmountToKopecks } from './money'

describe('parseAmountToKopecks', () => {
  it('принимает рубли с запятой и копейками', () => {
    expect(parseAmountToKopecks('1 234,50')).toBe(123450)
  })
})
