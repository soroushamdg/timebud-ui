import { RefreshCw } from 'lucide-react'
import { DbTask } from '@/types/database'

export interface RecurrenceValue {
  isRecurring: boolean
  recurrenceType: 'daily' | 'specific_days' | 'interval'
  recurrenceDays: number[]
  recurrenceInterval: number
  recurrenceEndType: 'none' | 'date' | 'after'
  recurrenceEndDate: string
  recurrenceEndAfter: number
  recurrenceMissedBehavior: 'overdue' | 'skip'
}

export function defaultRecurrenceValue(): RecurrenceValue {
  return {
    isRecurring: false,
    recurrenceType: 'daily',
    recurrenceDays: [1],
    recurrenceInterval: 2,
    recurrenceEndType: 'none',
    recurrenceEndDate: '',
    recurrenceEndAfter: 10,
    recurrenceMissedBehavior: 'overdue',
  }
}

type RecurrenceFields = Pick<
  DbTask,
  'recurrence_type' | 'recurrence_days' | 'recurrence_interval' | 'recurrence_end_date' | 'recurrence_end_after' | 'recurrence_missed_behavior'
>

// Reconstructs editor state from a task's stored recurrence fields — used to prefill
// the editor when editing an existing (possibly non-recurring) task.
export function recurrenceValueFromTask(task: RecurrenceFields | null | undefined): RecurrenceValue {
  if (!task || !task.recurrence_type) return defaultRecurrenceValue()
  return {
    isRecurring: true,
    recurrenceType: task.recurrence_type,
    recurrenceDays: task.recurrence_days && task.recurrence_days.length > 0 ? task.recurrence_days : [1],
    recurrenceInterval: task.recurrence_interval || 2,
    recurrenceEndType: task.recurrence_end_date ? 'date' : task.recurrence_end_after ? 'after' : 'none',
    recurrenceEndDate: task.recurrence_end_date || '',
    recurrenceEndAfter: task.recurrence_end_after || 10,
    recurrenceMissedBehavior: task.recurrence_missed_behavior || 'overdue',
  }
}

// The inverse: turns editor state back into the DB columns to persist. Centralizing this
// avoids re-deriving the same "only send the fields relevant to the chosen pattern/end
// type" logic at every call site.
export function recurrenceValueToFields(value: RecurrenceValue): RecurrenceFields {
  if (!value.isRecurring) {
    return {
      recurrence_type: null,
      recurrence_days: null,
      recurrence_interval: null,
      recurrence_end_date: null,
      recurrence_end_after: null,
      recurrence_missed_behavior: null,
    }
  }
  return {
    recurrence_type: value.recurrenceType,
    recurrence_days: value.recurrenceType === 'specific_days' ? value.recurrenceDays : null,
    recurrence_interval: value.recurrenceType === 'interval' ? value.recurrenceInterval : null,
    recurrence_end_date: value.recurrenceEndType === 'date' && value.recurrenceEndDate ? value.recurrenceEndDate : null,
    recurrence_end_after: value.recurrenceEndType === 'after' ? value.recurrenceEndAfter : null,
    recurrence_missed_behavior: value.recurrenceMissedBehavior,
  }
}

const WEEKDAYS = [
  { label: 'Sun', val: 0 }, { label: 'Mon', val: 1 }, { label: 'Tue', val: 2 }, { label: 'Wed', val: 3 },
  { label: 'Thu', val: 4 }, { label: 'Fri', val: 5 }, { label: 'Sat', val: 6 },
]

interface RecurrenceEditorProps {
  value: RecurrenceValue
  onChange: (next: RecurrenceValue) => void
  toggleLabel?: string
  toggleDescription?: string
  /** Compact spacing for tight contexts like popovers; full spacing otherwise. */
  compact?: boolean
}

export function RecurrenceEditor({
  value,
  onChange,
  toggleLabel = 'Repeats',
  toggleDescription = 'Make this a recurring job',
  compact = false,
}: RecurrenceEditorProps) {
  const set = (patch: Partial<RecurrenceValue>) => onChange({ ...value, ...patch })

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Recurrence toggle */}
      <div className="flex items-center justify-between bg-bg-card border border-border-card rounded-2xl px-5 py-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-accent-yellow" />
          <div>
            <span className="text-text-primary font-medium">{toggleLabel}</span>
            <p className="text-text-sec text-sm mt-0.5">{toggleDescription}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => set({ isRecurring: !value.isRecurring })}
          className={`w-14 h-7 rounded-full transition-all duration-200 ${
            value.isRecurring ? 'bg-accent-yellow' : 'bg-border-card'
          } relative border-2 ${
            value.isRecurring ? 'border-accent-yellow' : 'border-border-card'
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 bg-toggle-thumb rounded-full transition-transform duration-200 shadow-sm ${
              value.isRecurring ? 'translate-x-7' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Recurrence config */}
      {value.isRecurring && (
        <div className="bg-bg-card border border-border-card rounded-2xl px-5 py-4 space-y-5">
          {/* Pattern */}
          <div>
            <p className="text-text-sec text-sm font-medium mb-3">Repeat pattern</p>
            <div className="flex gap-2 flex-wrap">
              {(['daily', 'specific_days', 'interval'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => set({ recurrenceType: type })}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    value.recurrenceType === type
                      ? 'bg-accent-yellow text-on-light-accent'
                      : 'bg-bg-primary text-text-sec border border-border-card'
                  }`}
                >
                  {type === 'daily' ? 'Every day' : type === 'specific_days' ? 'Specific days' : 'Every X days'}
                </button>
              ))}
            </div>

            {value.recurrenceType === 'specific_days' && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {WEEKDAYS.map(({ label, val }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => set({
                      recurrenceDays: value.recurrenceDays.includes(val)
                        ? (value.recurrenceDays.filter(d => d !== val).length > 0 ? value.recurrenceDays.filter(d => d !== val) : value.recurrenceDays)
                        : [...value.recurrenceDays, val]
                    })}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                      value.recurrenceDays.includes(val)
                        ? 'bg-accent-yellow text-on-light-accent'
                        : 'bg-bg-primary text-text-sec border border-border-card'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {value.recurrenceType === 'interval' && (
              <div className="flex items-center gap-3 mt-3">
                <span className="text-text-sec text-sm">Every</span>
                <input
                  type="number"
                  min={2}
                  max={365}
                  value={value.recurrenceInterval}
                  onChange={e => set({ recurrenceInterval: Math.max(2, Math.min(365, parseInt(e.target.value) || 2)) })}
                  className="w-20 bg-bg-primary border border-border-card rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-yellow"
                />
                <span className="text-text-sec text-sm">days</span>
              </div>
            )}
          </div>

          {/* End condition */}
          <div>
            <p className="text-text-sec text-sm font-medium mb-3">Ends</p>
            <div className="flex gap-2 flex-wrap">
              {(['none', 'date', 'after'] as const).map(et => (
                <button
                  key={et}
                  type="button"
                  onClick={() => set({ recurrenceEndType: et })}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    value.recurrenceEndType === et
                      ? 'bg-accent-yellow text-on-light-accent'
                      : 'bg-bg-primary text-text-sec border border-border-card'
                  }`}
                >
                  {et === 'none' ? 'No end' : et === 'date' ? 'End date' : 'After X times'}
                </button>
              ))}
            </div>
            {value.recurrenceEndType === 'date' && (
              <input
                type="date"
                value={value.recurrenceEndDate}
                onChange={e => set({ recurrenceEndDate: e.target.value })}
                className="mt-3 w-full bg-bg-primary border border-border-card rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-yellow [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70"
              />
            )}
            {value.recurrenceEndType === 'after' && (
              <div className="flex items-center gap-3 mt-3">
                <span className="text-text-sec text-sm">After</span>
                <input
                  type="number"
                  min={1}
                  value={value.recurrenceEndAfter}
                  onChange={e => set({ recurrenceEndAfter: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-20 bg-bg-primary border border-border-card rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-yellow"
                />
                <span className="text-text-sec text-sm">times</span>
              </div>
            )}
          </div>

          {/* Missed behavior */}
          <div>
            <p className="text-text-sec text-sm font-medium mb-3">If a day is missed</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set({ recurrenceMissedBehavior: 'overdue' })}
                className={`p-3 rounded-xl text-left transition-colors border ${
                  value.recurrenceMissedBehavior === 'overdue'
                    ? 'border-accent-yellow bg-accent-yellow/10'
                    : 'border-border-card bg-bg-primary'
                }`}
              >
                <p className={`text-sm font-medium ${
                  value.recurrenceMissedBehavior === 'overdue' ? 'text-accent-yellow' : 'text-text-primary'
                }`}>Show as overdue</p>
                <p className="text-text-sec text-xs mt-0.5">Missed days stay visible</p>
              </button>
              <button
                type="button"
                onClick={() => set({ recurrenceMissedBehavior: 'skip' })}
                className={`p-3 rounded-xl text-left transition-colors border ${
                  value.recurrenceMissedBehavior === 'skip'
                    ? 'border-accent-yellow bg-accent-yellow/10'
                    : 'border-border-card bg-bg-primary'
                }`}
              >
                <p className={`text-sm font-medium ${
                  value.recurrenceMissedBehavior === 'skip' ? 'text-accent-yellow' : 'text-text-primary'
                }`}>Skip missed days</p>
                <p className="text-text-sec text-xs mt-0.5">Auto-skip and move on</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
