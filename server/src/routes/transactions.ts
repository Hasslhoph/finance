import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db/database.js'
import {
  createTransaction,
  createTransactions,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../domain/transactions.js'

const amountSchema = z
  .number({ invalid_type_error: 'Неверная сумма', required_error: 'Неверная сумма' })
  .int('Неверная сумма')
  .positive('Неверная сумма')

const transactionSchema = z.object({
  kind: z.enum(['expense', 'income', 'transfer'], { errorMap: () => ({ message: 'Неизвестный вид операции' }) }),
  date: z.string({ required_error: 'Неверная дата' }),
  amount: amountSchema,
  accountId: z.number({ invalid_type_error: 'Не выбран счёт' }).int(),
  categoryId: z.number().int().nullable().optional(),
  transferAccountId: z.number().int().nullable().optional(),
  person: z.enum(['sasha', 'tanya']).nullable().optional(),
  comment: z.string().max(500, 'Комментарий слишком длинный').optional(),
})

const batchSchema = z.object({
  items: z.array(transactionSchema).min(1, 'Список операций пуст'),
})

const listSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  kind: z.enum(['expense', 'income', 'transfer']).optional(),
  accountId: z.coerce.number().int().optional(),
  categoryId: z.coerce.number().int().optional(),
  person: z.enum(['sasha', 'tanya']).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export function registerTransactions(app: FastifyInstance, deps: { db: Db }): void {
  const { db } = deps

  app.post('/api/transactions', async (request, reply) => {
    const body = transactionSchema.parse(request.body)
    const item = createTransaction(db, body)
    return reply.code(201).send({ item })
  })

  app.post('/api/transactions/batch', async (request, reply) => {
    const body = batchSchema.parse(request.body)
    const items = createTransactions(db, body.items)
    return reply.code(201).send({ items })
  })

  app.get('/api/transactions', async (request) => {
    const filter = listSchema.parse(request.query)
    return listTransactions(db, filter)
  })

  app.patch<{ Params: { id: string } }>('/api/transactions/:id', async (request) => {
    const body = transactionSchema.partial().parse(request.body)
    const item = updateTransaction(db, Number(request.params.id), body)
    return { item }
  })

  app.delete<{ Params: { id: string } }>('/api/transactions/:id', async (request, reply) => {
    deleteTransaction(db, Number(request.params.id))
    return reply.code(204).send()
  })
}
