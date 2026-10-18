import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative'
  children?: ReactNode
}

const TONES = {
  default: 'text-text',
  positive: 'text-positive',
  negative: 'text-negative',
} as const

export function StatCard({ label, value, hint, tone = 'default', children }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="text-sm text-muted">{label}</h3>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {children}
    </article>
  )
}
