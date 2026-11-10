import { useEffect, useState } from 'react'

/** Branded loading screen shown while the auth session is restored. */
export function SplashScreen({ label = 'Connecting what’s lost with who cares' }: { label?: string }) {
  const [progress, setProgress] = useState(8)

  useEffect(() => {
    const timer = setInterval(() => setProgress((p) => (p >= 92 ? p : p + 4)), 60)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="splash-screen-container">
      <div className="gestures-full-backdrop" aria-hidden="true">
        <img src="/hand-gestures.png" alt="" className="hand-gestures-art-fullscreen" />
        <div className="gesture-ripple-ring ring-a" />
        <div className="gesture-ripple-ring ring-b" />
      </div>

      <header className="brand-wordmark-container">
        <img src="/foundit-logo.png" alt="foundit" className="foundit-brand-logo" />
        <p className="brand-subtext">{label}</p>
      </header>

      <div className="stage-spacer" />

      <footer className="loading-meter-section">
        <div className="status-label-row">
          <span className="status-text">Loading FoundIT…</span>
          <span className="progress-percentage">{progress}%</span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill orange-fill" style={{ width: `${progress}%` }}>
            <div className="progress-shimmer" />
          </div>
        </div>
      </footer>
    </div>
  )
}
