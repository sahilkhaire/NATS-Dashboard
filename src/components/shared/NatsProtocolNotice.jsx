import { useEffect } from 'react'

export function NatsProtocolNotice({ endpoint }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app-notify', {
      detail: {
        level: 'warning',
        title: 'Endpoint unavailable',
        message: `/${endpoint} requires HTTP monitoring port 8222 or NATS system account.`,
        source: 'monitoring',
      },
    }))
  }, [endpoint])

  return null
}
