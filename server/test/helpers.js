import Fastify from 'fastify';
import { ZodError } from 'zod';
import { openDatabase } from '../src/db/database.js';
import { runMigrations } from '../src/db/migrate.js';
export function createTestDb() {
    const db = openDatabase(':memory:');
    runMigrations(db);
    return db;
}
function categoryIdBySlug(db, slug) {
    const row = db.prepare('select id from categories where slug = ?').get(slug);
    if (!row) {
        throw new Error(`Нет категории со slug ${slug}`);
    }
    return row.id;
}
function categoryIdByName(db, name) {
    const row = db.prepare('select id from categories where name = ?').get(name);
    if (!row) {
        throw new Error(`Нет категории ${name}`);
    }
    return row.id;
}
export const foodId = (db) => categoryIdByName(db, 'Продукты');
export const salaryId = (db) => categoryIdBySlug(db, 'salary');
export const interestId = (db) => categoryIdBySlug(db, 'interest-income');
export const unrecognizedExpenseId = (db) => categoryIdBySlug(db, 'unrecognized-expense');
export function accountIdByName(db, name) {
    const row = db.prepare('select id from accounts where name = ?').get(name);
    if (!row) {
        throw new Error(`Нет счёта ${name}`);
    }
    return row.id;
}
export function rawTx(db, input) {
    const result = db
        .prepare(`insert into transactions (kind, date, amount, account_id, transfer_account_id, category_id, person, comment)
       values (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(input.kind, input.date, input.amount, input.accountId, input.transferAccountId ?? null, input.categoryId ?? null, input.person ?? null, input.comment ?? '');
    return Number(result.lastInsertRowid);
}
export function buildTestApp(db) {
    const app = Fastify();
    app.decorate('db', db);
    app.setErrorHandler((error, _request, reply) => {
        if (error instanceof ZodError) {
            return reply.code(400).send({ error: error.issues[0]?.message ?? 'Неверные данные' });
        }
        const status = error.statusCode ?? 400;
        return reply.code(status).send({ error: error.message });
    });
    return app;
}
export function countCorrections(db, accountId) {
    const row = db
        .prepare(`select count(*) as c from transactions where account_id = ? and category_id in (?, ?)`)
        .get(accountId, categoryIdBySlug(db, 'unrecognized-expense'), categoryIdBySlug(db, 'unrecognized-income'));
    return row.c;
}
export function dashboardExpense(db, from, to) {
    const row = db
        .prepare(`select coalesce(sum(amount), 0) as total from transactions where kind = 'expense' and date between ? and ?`)
        .get(from, to);
    return row.total;
}
