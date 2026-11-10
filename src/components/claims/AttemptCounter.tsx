import { ShieldAlert } from 'lucide-react'
import { MAX_ATTEMPTS } from '../../services/claims'

/** "3 of 5 attempts remaining" with a warning as the limit approaches. */
export function AttemptCounter({ remaining }: { remaining: number }) {
  const tone = remaining <= 1 ? 'alert-error' : remaining <= 2 ? 'alert-warning' : 'alert-info'
  return (
    <div className={`alert ${tone} attempt-counter`} role="status" aria-live="polite">
      <ShieldAlert size={18} />
      <span>
        <strong>
          {remaining} of {MAX_ATTEMPTS}
        </strong>{' '}
        verification attempts remaining.
        {remaining <= 2 && ' After that, the claim is locked and an administrator will review it.'}
      </span>
      <span className="attempt-dots" aria-hidden="true">
        {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
          <span key={i} className={i < remaining ? 'on' : ''} />
        ))}
      </span>
    </div>
  )
}
