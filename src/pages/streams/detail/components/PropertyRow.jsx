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
    <div className="flex items-start justify-between py-3 px-4 border-b border-nats-border last:border-0 group hover:bg-nats-border/20 transition-colors">
      <div className="text-sm text-gray-400 w-44 shrink-0 pt-0.5">{label}</div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            {options ? (
              <select
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="px-2 py-1 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent"
                autoFocus
              >
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={inputType}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="w-full px-2 py-1 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
              />
            )}
            <button onClick={save} disabled={saving} className="p-1 rounded hover:bg-nats-ok/20 text-nats-ok" title="Save">
              <Check size={14} />
            </button>
            <button onClick={cancel} className="p-1 rounded hover:bg-nats-border text-gray-400" title="Cancel">
              <XIcon size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-white break-all">{displayValue ?? value ?? '—'}</span>
            {editable && (
              <button
                onClick={startEdit}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-nats-border text-gray-400 hover:text-nats-accent transition-all"
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
