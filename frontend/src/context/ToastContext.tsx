import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextType {
  toast: (type: ToastType, title: string, message?: string, duration?: number) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  confirm: (title: string, message: string) => Promise<boolean>
}

const ToastContext = createContext<ToastContextType | null>(null)

interface ConfirmState {
  id: string
  title: string
  message: string
  resolve: (v: boolean) => void
}

const ICONS: Record<ToastType, string> = {
  success: '✓', error: '✕', warning: '⚠', info: 'ℹ'
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.35)', icon: '#3fb950' },
  error:   { bg: 'rgba(248,81,73,0.12)', border: 'rgba(248,81,73,0.35)', icon: '#f85149' },
  warning: { bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.35)', icon: '#d29922' },
  info:    { bg: 'rgba(79,142,247,0.12)', border: 'rgba(79,142,247,0.35)', icon: '#4f8ef7' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirms, setConfirms] = useState<ConfirmState[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const success = useCallback((title: string, msg?: string) => toast('success', title, msg), [toast])
  const error   = useCallback((title: string, msg?: string) => toast('error', title, msg, 6000), [toast])
  const warning = useCallback((title: string, msg?: string) => toast('warning', title, msg), [toast])
  const info    = useCallback((title: string, msg?: string) => toast('info', title, msg), [toast])

  const confirm = useCallback((title: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
      const id = `confirm-${Date.now()}`
      setConfirms(prev => [...prev, { id, title, message, resolve }])
    })
  }, [])

  const handleConfirm = (id: string, value: boolean) => {
    setConfirms(prev => {
      const item = prev.find(c => c.id === id)
      item?.resolve(value)
      return prev.filter(c => c.id !== id)
    })
  }

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, confirm }}>
      {children}

      {/* Toast container */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none'
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type]
          return (
            <div key={t.id} role="alert" style={{
              background: 'var(--bg-secondary)',
              border: `1px solid ${c.border}`,
              borderLeft: `3px solid ${c.icon}`,
              borderRadius: 10,
              padding: '12px 16px',
              minWidth: 280, maxWidth: 380,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              pointerEvents: 'all',
              animation: 'toastIn 0.25s ease',
              display: 'flex', gap: 10, alignItems: 'flex-start'
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: c.bg, color: c.icon,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1
              }}>{ICONS[t.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: t.message ? 2 : 0 }}>{t.title}</div>
                {t.message && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.message}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 14, padding: '0 2px', flexShrink: 0
              }} aria-label="Tutup notifikasi">✕</button>
            </div>
          )
        })}
      </div>

      {/* Confirm dialogs */}
      {confirms.map(c => (
        <div key={c.id} className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={`confirm-title-${c.id}`}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title" id={`confirm-title-${c.id}`}>{c.title}</div>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => handleConfirm(c.id, false)}>Batal</button>
              <button className="btn btn-danger" onClick={() => handleConfirm(c.id, true)} autoFocus>Hapus</button>
            </div>
          </div>
        </div>
      ))}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
