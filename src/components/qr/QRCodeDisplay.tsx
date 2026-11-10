import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'
import { qrUrl } from '../../services/qr'
import { Skeleton } from '../ui'

/**
 * Renders the SVG QR code for a collection point (admin use) with
 * download / print actions. No secret is involved: the slug is a routing
 * token, not a credential (spec §27.1).
 */
export function QRCodeDisplay({ slug, name, size = 220 }: { slug: string; name: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null)
  const url = qrUrl(slug)

  useEffect(() => {
    let active = true
    QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((markup) => active && setSvg(markup))
      .catch(() => active && setSvg(null))
    return () => {
      active = false
    }
  }, [url])

  const download = () => {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `foundit-qr-${slug}.svg`
    a.click()
    URL.revokeObjectURL(href)
  }

  const print = () => {
    if (!svg) return
    const win = window.open('', '_blank', 'width=600,height=800')
    if (!win) return
    const doc = win.document
    doc.title = `FoundIT QR — ${name}`
    const style = doc.createElement('style')
    style.textContent =
      'body{font-family:system-ui,sans-serif;text-align:center;padding:40px}' +
      'h1{font-size:28px;margin:0 0 8px}p{color:#475569;margin:4px 0}' +
      '.qr{width:360px;margin:24px auto}.qr svg{width:100%;height:auto}' +
      '.cta{font-size:20px;font-weight:700;color:#f26a36;margin-top:16px}'
    doc.head.appendChild(style)
    const h1 = doc.createElement('h1')
    h1.textContent = name
    const sub = doc.createElement('p')
    sub.textContent = 'FoundIT Box — Smart Lost & Found'
    const qr = doc.createElement('div')
    qr.className = 'qr'
    qr.innerHTML = svg // generated locally by the qrcode library, not user input
    const cta = doc.createElement('p')
    cta.className = 'cta'
    cta.textContent = 'Found something? Lost something? Scan me.'
    const link = doc.createElement('p')
    link.textContent = url
    doc.body.append(h1, sub, qr, cta, link)
    win.focus()
    win.print()
  }

  return (
    <div className="qr-display">
      {svg ? (
        <div className="qr-svg" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <Skeleton width={size} height={size} radius={12} />
      )}
      <code className="small muted qr-url">{url}</code>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={download} disabled={!svg}>
          <Download size={14} /> SVG
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={print} disabled={!svg}>
          <Printer size={14} /> Print
        </button>
      </div>
    </div>
  )
}
