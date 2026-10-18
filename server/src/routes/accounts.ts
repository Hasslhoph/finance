import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db/database.js'
import { accountBalance } from '../domain/balances.js'
import { archiveAccount, createAccount, listAccounts, updateAccount } from '../domain/accounts.js'
import { checkBalance, listChecks } from '../domain/reconciliation.js'

const accountSchema = z.object({
  name: z.string({ required_error: 'Название обязательно' }).min(1, 'Название обязательно'),
  kind: z.enum(['card', 'cash', 'deposit'], { errorMap: () => ({ message: 'Неизвестный вид счёта' }) }),
  owner: z.enum(['sasha', 'tanya', 'shared'], { errorMap: () => ({ message: 'Неизвестный владелец' }) }),
  openingBalance: z
    .number({ invalid_type_error: 'Начальный остаток должен быть числом' })
    .int('Начальный остаток должен быть целым числом копеек')
    .default(0),
  openingDate: z.string({ required_error: 'Дата обязательна' }),
})

const checkSchema = z.object({
  date: z.string({ required_error: 'Дата обязательна' }),
  actualBalance: z
    .number({ invalid_type_error: 'Остаток должен быть числом' })
    .int('Остаток должен быть целым числом копеек'),
})

export function registerAccounts(app: FastifyInstance, deps: { db: Db }): void {
  const { db } = deps

  app.get('/api/accounts', async () => {
    const items = listAccounts(db).map((account) => ({
      ...account,
      balance: accountBalance(db, account.id),
    }))
    return { items }
  })

  app.post('/api/accounts', async (request, reply) => {
    const body = accountSchema.parse(request.body)
    const item = createAccount(db, body)
    return reply.code(201).send({ item })
  })

  app.patch<{ Params: { id: string } }>('/api/accounts/:id', async (request) => {
    const body = accountSchema.partial().parse(request.body)
    const item = updateAccount(db, Number(request.params.id), body)
    return { item }
  })

  app.delete<{ Params: { id: string } }>('/api/accounts/:id', async (request, reply) => {
    archiveAccount(db, Number(request.params.id))
    return reply.code(204).send()
  })

  app.post<{ Params: { id: string } }>('/api/accounts/:id/check', async (request) => {
    const body = checkSchema.parse(request.body)
    return checkBalance(db, { accountId: Number(request.params.id), ...body })
  })

  app.get<{ Params: { id: string } }>('/api/accounts/:id/checks', async (request) => {
    return { items: listChecks(db, Number(request.params.id)) }
  })
}
