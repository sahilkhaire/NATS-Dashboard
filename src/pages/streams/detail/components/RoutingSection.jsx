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

  const inputCls = "w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"

  return (
    <SectionBox title="Subject Transform & Republish">
      <div className="p-4 space-y-5">
        {/* Subject Transform */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Subject Transform</div>
          <p className="text-xs text-gray-500 mb-2">Rewrite matching subjects before storing messages.</p>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Source pattern (empty = all)</label>
              <input value={stSrc} onChange={e => setStSrc(e.target.value)} placeholder="e.g. foo.>" className={inputCls} />
            </div>
            <span className="text-gray-600 mt-5">→</span>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Destination</label>
              <input value={stDest} onChange={e => setStDest(e.target.value)} placeholder="e.g. bar.>" className={inputCls} />
            </div>
            <button onClick={saveTransform} disabled={saving === 'transform'} className="mt-5 px-3 py-1.5 rounded border border-nats-border text-xs text-gray-400 hover:text-nats-accent hover:border-nats-accent/50 disabled:opacity-50 transition-colors whitespace-nowrap">
              {saving === 'transform' ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>

        <div className="border-t border-nats-border" />

        {/* Republish */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Republish</div>
          <p className="text-xs text-gray-500 mb-2">Immediately republish stored messages to another subject.</p>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Source filter (empty = all)</label>
              <input value={rpSrc} onChange={e => setRpSrc(e.target.value)} placeholder="e.g. orders.>" className={inputCls} />
            </div>
            <span className="text-gray-600 mt-5">→</span>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Destination subject</label>
              <input value={rpDst} onChange={e => setRpDst(e.target.value)} placeholder="e.g. pub.orders.>" className={inputCls} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={rpHdrs} onChange={e => setRpHdrs(e.target.checked)} className="accent-nats-accent" />
              Headers only (don&apos;t republish payload)
            </label>
            <button onClick={saveRepublish} disabled={saving === 'republish'} className="px-3 py-1.5 rounded border border-nats-border text-xs text-gray-400 hover:text-nats-accent hover:border-nats-accent/50 disabled:opacity-50 transition-colors">
              {saving === 'republish' ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-nats-error">{error}</p>}
      </div>
    </SectionBox>
  )
}
