import { useEffect } from 'react'
import { useNotifications } from '../../context/NotificationContext'

function extractMessage(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(extractMessage).join(' ').trim()
  if (typeof value === 'object' && value.props?.children != null) return extractMessage(value.props.children)
  return ''
}

export function AlertBanner({ variant = 'error', title, children }) {
  const { pushNotification } = useNotifications()

  useEffect(() => {
    const levelByVariant = {
      error: 'error',
      warn: 'warning',
      info: 'info',
    }
    pushNotification({
      level: levelByVariant[variant] || 'info',
      title: title || 'Notification',
      message: extractMessage(children),
      source: 'alert-banner',
    })
  }, [children, pushNotification, title, variant])

  return null
}
