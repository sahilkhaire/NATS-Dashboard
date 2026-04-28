import { useState } from 'react'
import { SectionBox } from './SectionBox'

export function RoutingSection({ cfg, onUpdate, streamName }) {
  const st = cfg.subject_transform || {}
  const rp = cfg.republish         || {}

  const [stSrc,  setStSrc]  = useState(st.src  ?? '')
  const [stDest, setStDest] = useState(st.dest  ?? '')
  const [rpSrc,  setRpSrc]  = useState(rp.src   ?? '')
  const [rpDst,  setRpDst]  = useState(rp.dst   ?? '')
  const [rpHdrs, setRpHdrs] = useState(rp.headers_only ?? false)
  const [saving, setSaving] = useState(null)
  const [error,  setError]  = useState('')

  const saveTransform = async () => {
    setSaving('transform'); setError('')
    try {
      const val = (stSrc.trim() || stDest.trim()) ? { src: stSrc.trim() || undefined, dest: stDest.trim() } : null
      await onUpdate(streamName, { subject_transform: val })
    } catch (err) { setError(err.message) } finally { setSaving(null) }
  }

  const saveRepublish = async () => {
    setSaving('republish'); setError('')
    try {
      const val = rpDst.trim() ? { src: rpSrc.trim() || undefined, dst: rpDst.trim(), headers_only: rpHdrs } : null
      await onUpdate(streamName, { republish: val })
    } catch (err) { setError(err.message) } finally { setSaving(null) }
  }

  const inputCls = "input-enterprise w-full px-2 py-1.5 text-sm font-mono"

  return (
    <SectionBox title="Subject Transform & Republish">
      <div className="p-4 space-y-5">
        {/* Subject Transform */}
        <div className="space-y-2">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject Transform</div>
          <p className="mb-2 text-xs text-muted-foreground">Rewrite matching subjects before storing messages.</p>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Source pattern (empty = all)</label>
              <input value={stSrc} onChange={e => setStSrc(e.target.value)} placeholder="e.g. foo.>" className={inputCls} />
            </div>
            <span className="mt-5 text-muted-foreground">→</span>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Destination</label>
              <input value={stDest} onChange={e => setStDest(e.target.value)} placeholder="e.g. bar.>" className={inputCls} />
            </div>
            <button onClick={saveTransform} disabled={saving === 'transform'} className="mt-5 whitespace-nowrap rounded border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50">
              {saving === 'transform' ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Republish */}
        <div className="space-y-2">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Republish</div>
          <p className="mb-2 text-xs text-muted-foreground">Immediately republish stored messages to another subject.</p>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Source filter (empty = all)</label>
              <input value={rpSrc} onChange={e => setRpSrc(e.target.value)} placeholder="e.g. orders.>" className={inputCls} />
            </div>
            <span className="mt-5 text-muted-foreground">→</span>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Destination subject</label>
              <input value={rpDst} onChange={e => setRpDst(e.target.value)} placeholder="e.g. pub.orders.>" className={inputCls} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={rpHdrs} onChange={e => setRpHdrs(e.target.checked)} className="accent-nats-accent" />
              Headers only (don&apos;t republish payload)
            </label>
            <button onClick={saveRepublish} disabled={saving === 'republish'} className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50">
              {saving === 'republish' ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-nats-error">{error}</p>}
      </div>
    </SectionBox>
  )
}
