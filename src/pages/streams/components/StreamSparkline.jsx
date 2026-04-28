import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'

function formatSparklineValue(value, metric) {
  if (metric === 'bytesPerSec') {
    if (!Number.isFinite(value)) return '0 B/s'
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    let scaled = value
    let i = 0
    while (scaled >= 1024 && i < units.length - 1) {
      scaled /= 1024
      i += 1
    }
    return `${scaled.toFixed(scaled >= 10 ? 1 : 2)} ${units[i]}`
  }
  return `${Number(value || 0).toFixed(1)} msg/s`
}

export function StreamSparkline({ points, metric = 'msgsPerSec' }) {
  const hasData = Array.isArray(points) && points.length > 1

  if (!hasData) {
    return <span className="text-[10px] text-muted-foreground">warming up…</span>
  }

  return (
    <div className="h-10 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points}>
          <Tooltip
            contentStyle={{
              backgroundColor: '#11151f',
              border: '1px solid #2a3140',
              borderRadius: 8,
              color: '#e5e7eb',
              fontSize: 11,
            }}
            formatter={(value) => formatSparklineValue(Number(value), metric)}
            labelFormatter={() => ''}
          />
          <Area
            dataKey={metric}
            type="monotone"
            stroke="#22d3ee"
            fill="#22d3ee"
            fillOpacity={0.2}
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

