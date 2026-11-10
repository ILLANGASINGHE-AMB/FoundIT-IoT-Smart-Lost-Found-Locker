import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Inbox, X } from 'lucide-react'
import { initials } from '../../lib/format'

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = 'Back',
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      {backTo && (
        <Link to={backTo} className="back-link">
          <ArrowLeft size={16} /> {backLabel}
        </Link>
      )}
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </header>
    </div>
  )
}

export function Skeleton({
  height = 16,
  width = '100%',
  radius,
}: {
  height?: number | string
  width?: number | string
  radius?: number
}) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden="true" />
}

export function SkeletonList({ rows = 4, height = 72 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius={14} />
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="card-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={260} radius={16} />
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon ?? <Inbox size={26} />}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  dismissible = true,
  labelledBy = 'modal-title',
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  dismissible?: boolean
  labelledBy?: string
}) {
  useEffect(() => {
    if (!dismissible) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismissible, onClose])

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="modal-header">
          <h2 id={labelledBy}>{title}</h2>
          {dismissible && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function Avatar({ src, name, size = 36 }: { src?: string | null; name?: string | null; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', display: 'inline-block', flexShrink: 0 }}
    >
      {src ? (
        <img src={src} alt={name ?? 'Avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span className="avatar-fallback" style={{ fontSize: size * 0.36 }}>
          {initials(name)}
        </span>
      )}
    </span>
  )
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <span className="field-error" role="alert">
      {message}
    </span>
  )
}
