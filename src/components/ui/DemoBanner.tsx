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
    return () => window.removeEventListener('foundit-demo-email', onEmail)
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
      <span>
        <strong>Demo mode</strong> — data is stored only in this browser (no Supabase connected).
      </span>
      <button type="button" onClick={reset} disabled={busy}>
        <RotateCcw size={12} /> Reset demo data
      </button>
    </div>
  )
}
