export function BoolBadge({ value, onLabel = 'Enabled', offLabel = 'Disabled', warn = false }) {
  if (value) return <span className={`text-xs font-medium ${warn ? 'text-nats-warn' : 'text-nats-ok'}`}>{onLabel}</span>
  return <span className="text-xs text-gray-500">{offLabel}</span>
}
