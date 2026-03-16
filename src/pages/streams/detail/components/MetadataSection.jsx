import { useState } from 'react'
import { Plus, Check, X as XIcon } from 'lucide-react'
import { SectionBox } from './SectionBox'

export function MetadataSection({ metadata, onSave }) {
  const [pairs,   setPairs]   = useState(() => Object.entries(metadata || {}))
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [dirty,   setDirty]   = useState(false)

  const update = (i, field, val) => {
    setPairs(prev => { const next = [...prev]; next[i] = [...next[i]]; next[i][field === 'k' ? 0 : 1] = val; return next })
    setDirty(true)
  }
  const addRow    = () => { setPairs(prev => [...prev, ['', '']]); setDirty(true) }
  const removeRow = (i) => { setPairs(prev => prev.filter((_, idx) => idx !== i)); setDirty(true) }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const obj = Object.fromEntries(pairs.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), v]))
      await onSave(obj)
      setDirty(false)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <SectionBox
      title="Metadata"
      badge={dirty && <span className="text-xs text-nats-warn px-1.5 py-0.5 rounded bg-nats-warn/10 border border-nats-warn/20">Unsaved</span>}
    >
      <div className="p-4 space-y-2">
        {pairs.length === 0 && !dirty && (
          <p className="text-xs text-gray-500">No metadata. Click Add to create key-value pairs.</p>
        )}
        {pairs.map(([k, v], i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={k} onChange={e => update(i, 'k', e.target.value)} placeholder="Key"
              className="w-36 px-2 py-1 text-xs rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
            <span className="text-gray-600 text-xs">=</span>
            <input value={v} onChange={e => update(i, 'v', e.target.value)} placeholder="Value"
              className="flex-1 px-2 py-1 text-xs rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
            <button onClick={() => removeRow(i)} className="p-1 rounded hover:bg-nats-error/20 text-gray-500 hover:text-nats-error">
              <XIcon size={12} />
            </button>
          </div>
        ))}
        {error && <p className="text-xs text-nats-error">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={addRow} className="flex items-center gap-1 px-2.5 py-1 rounded border border-nats-border text-xs text-gray-400 hover:text-nats-accent hover:border-nats-accent/50 transition-colors">
            <Plus size={11} /> Add
          </button>
          {dirty && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-2.5 py-1 rounded border border-nats-ok/40 text-nats-ok text-xs hover:bg-nats-ok/10 disabled:opacity-50 transition-colors">
              <Check size={11} /> {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </SectionBox>
  )
}
