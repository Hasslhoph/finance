import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db/database.js'
import { archiveCategory, createCategory, listCategories, updateCategory } from '../domain/categories.js'

const categorySchema = z.object({
  name: z.string({ required_error: 'Название обязательно' }).min(1, 'Название обязательно'),
  groupName: z.string({ required_error: 'Группа обязательна' }).min(1, 'Группа обязательна'),
  kind: z.enum(['expense', 'income'], { errorMap: () => ({ message: 'Неизвестный вид категории' }) }),
  color: z.string({ required_error: 'Цвет обязателен' }).regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в формате #RRGGBB'),
  icon: z.string().max(8).nullable().optional(),
})

const listSchema = z.object({
  kind: z.enum(['expense', 'income']).optional(),
  includeArchived: z.coerce.boolean().optional(),
})

export function registerCategories(app: FastifyInstance, deps: { db: Db }): void {
  const { db } = deps

  app.get('/api/categories', async (request) => {
    const query = listSchema.parse(request.query)
    return { items: listCategories(db, query) }
  })

  app.post('/api/categories', async (request, reply) => {
    const body = categorySchema.parse(request.body)
    const item = createCategory(db, body)
    return reply.code(201).send({ item })
  })

  app.patch<{ Params: { id: string } }>('/api/categories/:id', async (request) => {
    const body = categorySchema.partial().parse(request.body)
    const item = updateCategory(db, Number(request.params.id), body)
    return { item }
  })

  app.delete<{ Params: { id: string } }>('/api/categories/:id', async (request, reply) => {
    archiveCategory(db, Number(request.params.id))
    return reply.code(204).send()
  })
}
