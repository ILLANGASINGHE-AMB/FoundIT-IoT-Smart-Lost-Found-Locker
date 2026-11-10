import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { resetDemo } from '../../lib/demo/client'

/**
 * Shown in demo mode: data lives only in this browser. Also surfaces the
 * "emails" demo mode would have sent (password-reset links).
 */
export function DemoBanner() {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onEmail = (e: Event) => {
      const { to, link } = (e as CustomEvent<{ to: string; link: string }>).detail
      toast('Demo email: password reset', {
        description: `Sent to ${to}. In demo mode, open the link to continue.`,
        action: { label: 'Open link', onClick: () => window.location.assign(link) },
        duration: 20000,
      })
    }
    window.addEventListener('foundit-demo-email', onEmail)
    document.body.classList.add('demo-mode')
    return () => {
      window.removeEventListener('foundit-demo-email', onEmail)
      document.body.classList.remove('demo-mode')
    }
  }, [])

  const reset = async () => {
    if (!window.confirm('Reset all demo data? Everything you created in this browser will be deleted.')) return
    setBusy(true)
    await resetDemo()
    window.location.assign('/login')
  }

  return (
    <div className="demo-banner" role="status">
      <FlaskConical size={14} />
      <span className="demo-banner-text">
        <strong>Demo mode</strong> — data is stored only in this browser (no Supabase connected).
      </span>
      <span className="demo-banner-short" title="Demo mode — data is stored only in this browser">
        Demo
      </span>
      <button type="button" onClick={reset} disabled={busy} aria-label="Reset demo data" title="Reset demo data">
        <RotateCcw size={12} /> <span className="demo-banner-reset-label">Reset demo data</span>
      </button>
    </div>
  )
}
