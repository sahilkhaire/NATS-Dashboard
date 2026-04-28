import { useState } from 'react'
import { Pencil, Check, X as XIcon } from 'lucide-react'

export function PropertyRow({ label, value, displayValue, editable, inputType = 'text', options, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const startEdit = () => { setDraft(value ?? ''); setError(''); setEditing(true) }
  const cancel    = () => setEditing(false)

  const save = async () => {
    setError('')
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="group flex items-start justify-between border-b border-border px-4 py-3 transition-colors hover:bg-muted/20 last:border-0">
      <div className="w-44 shrink-0 pt-0.5 text-sm text-muted-foreground">{label}</div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            {options ? (
              <select
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="input-enterprise px-2 py-1 text-sm"
                autoFocus
              >
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={inputType}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="input-enterprise w-full px-2 py-1 text-sm font-mono"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
              />
            )}
            <button onClick={save} disabled={saving} className="p-1 rounded hover:bg-nats-ok/20 text-nats-ok" title="Save">
              <Check size={14} />
            </button>
            <button onClick={cancel} className="rounded p-1 text-muted-foreground hover:bg-muted" title="Cancel">
              <XIcon size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="break-all font-mono text-sm text-foreground">{displayValue ?? value ?? '—'}</span>
            {editable && (
              <button
                onClick={startEdit}
                className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-primary group-hover:opacity-100"
                title={`Edit ${label}`}
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
        )}
        {error && <div className="text-xs text-nats-error mt-1">{error}</div>}
      </div>
    </div>
  )
}
