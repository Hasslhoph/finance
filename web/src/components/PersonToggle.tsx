import type { Person } from '../api/types.js'

const PEOPLE: Array<{ id: Person; label: string }> = [
  { id: 'sasha', label: 'Саша' },
  { id: 'tanya', label: 'Таня' },
]

export function PersonToggle({ value, onChange }: { value: Person; onChange: (person: Person) => void }) {
  return (
    <div role="group" aria-label="Кто" className="flex rounded-xl border border-border bg-surface p-1">
      {PEOPLE.map((person) => (
        <button
          key={person.id}
          type="button"
          aria-pressed={value === person.id}
          onClick={() => onChange(person.id)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
            value === person.id ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
          }`}
        >
          {person.label}
        </button>
      ))}
    </div>
  )
}
