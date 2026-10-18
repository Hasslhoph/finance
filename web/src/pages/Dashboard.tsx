import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import type { DashboardResponse } from '../api/types.js'
import { CategoryLegend } from '../components/CategoryLegend.js'
import { DonutChart } from '../components/DonutChart.js'
import { InsightList } from '../components/InsightList.js'
import { PeriodSwitcher, type Preset } from '../components/PeriodSwitcher.js'
import { SavedBars } from '../components/SavedBars.js'
import { StatCard } from '../components/StatCard.js'
import { formatRub } from '../lib/money.js'

export function Dashboard() {
  const [preset, setPreset] = useState<Preset>('month')
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const query = custom ? { from: custom.from, to: custom.to } : { preset }
      setData(await api.get<DashboardResponse>('/api/dashboard', query))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [preset, custom])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data) {
    return (
      <div aria-busy="true" className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-surface-2" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-32 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div role="alert" className="rounded-2xl border border-negative/30 bg-negative/5 p-5">
        <p className="text-negative">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-xl border border-border px-3 py-1.5 text-sm"
        >
          Повторить
        </button>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const isEmpty = data.expense.total === 0 && data.income.total === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Обзор</h1>
          <p className="text-sm text-muted">
            {data.range.from === data.range.to ? data.range.from : `${data.range.from} — ${data.range.to}`}
          </p>
        </div>
        <PeriodSwitcher
          preset={preset}
          custom={custom}
          onPreset={(next) => {
            setCustom(null)
            setPreset(next)
          }}
          onCustom={setCustom}
        />
      </div>

      {isEmpty && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-medium">Пока нет операций</h2>
          <p className="mt-1 text-sm text-muted">
            Внесите первую трату — и здесь появятся цифры: сколько есть, сколько отложили и на что ушло.
          </p>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Всего денег"
          value={formatRub(data.totals.total)}
          hint={`из них на вкладах ${formatRub(data.totals.deposits)}`}
        />
        <StatCard label="Доступно" value={formatRub(data.totals.available)} hint="не на вкладах" />
        <StatCard
          label="Отложено за период"
          value={formatRub(data.saved.amount)}
          tone={data.saved.amount >= 0 ? 'positive' : 'negative'}
          hint={data.saved.ratio === null ? 'поступлений за период нет' : `${Math.round(data.saved.ratio * 100)}% от поступлений`}
        />
        <StatCard label="Заработано за период" value={formatRub(data.income.total)}>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Саша</dt>
              <dd className="tabular-nums">{formatRub(data.income.sasha)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Таня</dt>
              <dd className="tabular-nums">{formatRub(data.income.tanya)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Проценты по вкладам</dt>
              <dd className="tabular-nums">{formatRub(data.income.interest)}</dd>
            </div>
          </dl>
        </StatCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm text-muted">Расходы по категориям</h2>
          {data.byCategory.length === 0 ? (
            <p className="mt-3 text-sm text-muted">За этот период трат не было.</p>
          ) : (
            <>
              <DonutChart items={data.byCategory} />
              <p className="mt-2 text-center text-sm text-muted">
                Всего {formatRub(data.expense.total)}
              </p>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm text-muted">Разбивка по категориям</h2>
          <div className="mt-3">
            {data.byCategory.length === 0 ? (
              <p className="text-sm text-muted">Как только появятся траты, здесь будет разбивка.</p>
            ) : (
              <CategoryLegend items={data.byCategory} />
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm text-muted">Отложено по месяцам</h2>
        <div className="mt-3">
          <SavedBars history={data.history} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm text-muted">На что обратить внимание</h2>
        <div className="mt-3">
          <InsightList insights={data.insights} />
        </div>
      </section>
    </div>
  )
}
