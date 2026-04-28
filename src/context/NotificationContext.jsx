import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu'

const NotificationContext = createContext(null)

const TOAST_TIMEOUT_MS = 4500
const MAX_NOTIFICATIONS = 100

function buildNotification(partial = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: partial.title || 'Notification',
    message: partial.message || '',
    level: partial.level || 'info',
    createdAt: Date.now(),
    read: false,
    source: partial.source || 'app',
  }
}

function ToastItem({ item, onClose }) {
  const styleByLevel = {
    error: {
      icon: <AlertCircle size={16} className="text-red-500" />,
      container: 'border-red-500/40 bg-red-500/10',
      title: 'text-red-700 dark:text-red-400',
      message: 'text-red-800 dark:text-red-300',
      close: 'text-red-700/80 hover:bg-red-500/15 hover:text-red-700 dark:text-red-300/90 dark:hover:text-red-300',
    },
    warning: {
      icon: <AlertTriangle size={16} className="text-amber-500" />,
      container: 'border-amber-500/40 bg-amber-500/10',
      title: 'text-amber-600 dark:text-amber-400',
      message: 'text-amber-700 dark:text-amber-300',
      close: 'text-amber-700/80 hover:bg-amber-500/15 hover:text-amber-700 dark:text-amber-300/90 dark:hover:text-amber-300',
    },
    success: {
      icon: <CheckCircle2 size={16} className="text-emerald-500" />,
      container: 'border-emerald-500/40 bg-emerald-500/10',
      title: 'text-emerald-700 dark:text-emerald-400',
      message: 'text-emerald-800 dark:text-emerald-300',
      close: 'text-emerald-700/80 hover:bg-emerald-500/15 hover:text-emerald-700 dark:text-emerald-300/90 dark:hover:text-emerald-300',
    },
    info: {
      icon: <Bell size={16} className="text-primary" />,
      container: 'border-primary/30 bg-primary/10',
      title: 'text-primary',
      message: 'text-primary/90',
      close: 'text-primary/80 hover:bg-primary/15 hover:text-primary',
    },
  }
  const style = styleByLevel[item.level] || styleByLevel.info

  return (
    <div className={`w-80 rounded-md border p-3 shadow-lg backdrop-blur ${style.container}`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{style.icon}</div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold ${style.title}`}>{item.title}</div>
          {item.message && <div className={`mt-1 text-xs ${style.message}`}>{item.message}</div>}
        </div>
        <button onClick={() => onClose(item.id)} className={`rounded p-1 transition-colors ${style.close}`} aria-label="Close notification">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

function NotificationToasts({ toasts, dismissToast }) {
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[70] flex flex-col gap-2">
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastItem item={item} onClose={dismissToast} />
        </div>
      ))}
    </div>
  )
}

export function NotificationCenterButton() {
  const { notifications, unreadCount, markAllRead } = useNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Notifications" className="relative">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">
            Mark all read
          </button>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-auto">
          {notifications.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`border-b border-border px-2 py-2 last:border-b-0 ${n.read ? '' : 'bg-muted/50'}`}>
                <div className="text-sm font-medium">{n.title}</div>
                {n.message && <div className="mt-0.5 text-xs text-muted-foreground">{n.message}</div>}
                <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {n.level} · {new Date(n.createdAt).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((partial) => {
    const item = buildNotification(partial)
    setToasts((prev) => [item, ...prev].slice(0, 5))
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== item.id))
    }, TOAST_TIMEOUT_MS)
    return item
  }, [])

  const pushNotification = useCallback((partial) => {
    const item = buildNotification(partial)
    setNotifications((prev) => [item, ...prev].slice(0, MAX_NOTIFICATIONS))
    return item
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const api = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    showToast,
    pushNotification,
    dismissToast,
    markAllRead,
    notifyError: (title, message, source = 'app') => showToast({ level: 'error', title, message, source }),
    notifyWarning: (title, message, source = 'app') => showToast({ level: 'warning', title, message, source }),
    notifySuccess: (title, message, source = 'app') => showToast({ level: 'success', title, message, source }),
    notifyInfo: (title, message, source = 'app') => showToast({ level: 'info', title, message, source }),
  }), [dismissToast, markAllRead, notifications, pushNotification, showToast])

  useEffect(() => {
    const onNotify = (event) => {
      const detail = event?.detail || {}
      const payload = {
        level: detail.level || 'info',
        title: detail.title || 'Notification',
        message: detail.message || '',
        source: detail.source || 'system',
      }
      const channel = detail.channel || 'notification'
      if (channel === 'toast') {
        showToast(payload)
      } else if (channel === 'both') {
        pushNotification(payload)
        showToast(payload)
      } else {
        pushNotification(payload)
      }
    }
    window.addEventListener('app-notify', onNotify)
    return () => window.removeEventListener('app-notify', onNotify)
  }, [pushNotification, showToast])

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <NotificationToasts toasts={toasts} dismissToast={dismissToast} />
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
