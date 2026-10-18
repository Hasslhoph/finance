import { forwardRef } from 'react'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { value, onChange, onEnter },
  ref,
) {
  return (
    <div>
      <label htmlFor="amount" className="text-sm text-muted">
        Сумма
      </label>
      <div className="mt-1 flex items-baseline gap-2 border-b border-border pb-2 focus-within:border-accent">
        <input
          id="amount"
          ref={ref}
          value={value}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onEnter?.()
            }
          }}
          className="w-full bg-transparent text-4xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted/40"
        />
        <span className="text-2xl text-muted">₽</span>
      </div>
    </div>
  )
})
