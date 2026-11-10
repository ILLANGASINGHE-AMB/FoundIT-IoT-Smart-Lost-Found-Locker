import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'foundit-install-dismissed'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * "Add FoundIT to your home screen" prompt (PWA), shown on mobile after a
 * successful QR scan. Uses the browser's beforeinstallprompt where
 * available; iOS Safari gets a short manual hint.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(wasDismissed)

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isMobile = window.matchMedia?.('(max-width: 767px)').matches

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* storage unavailable — dismiss for this visit only */
    }
  }

  if (hidden || isStandalone || !isMobile || (!deferred && !isIos)) return null

  return (
    <div className="install-prompt" role="dialog" aria-label="Install FoundIT">
      <img src="/pwa-192x192.png" alt="" width={40} height={40} />
      <div>
        <strong>Add FoundIT to your home screen</strong>
        <p className="small muted">
          {deferred ? 'Open it like an app next time you find or lose something.' : 'Tap Share, then “Add to Home Screen”.'}
        </p>
      </div>
      {deferred && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={async () => {
            await deferred.prompt()
            await deferred.userChoice
            setDeferred(null)
            dismiss()
          }}
        >
          <Download size={14} /> Install
        </button>
      )}
      <button type="button" className="icon-btn" onClick={dismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}
