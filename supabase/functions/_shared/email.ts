// Transactional email via Resend (https://resend.com). Optional: without
// RESEND_API_KEY, notifications are delivered in-app only.

export function emailConfigured(): boolean {
  return Boolean(Deno.env.get('RESEND_API_KEY'))
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function renderEmail(title: string, message: string, link?: string | null): string {
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
  const href = link && appUrl ? `${appUrl}${link.startsWith('/') ? link : `/${link}`}` : appUrl
  return `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:#f26a36;padding:18px 24px;color:#ffffff;font-size:20px;font-weight:800">found<span style="opacity:.85">it</span></td></tr>
        <tr><td style="padding:24px">
          <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
          <p style="font-size:15px;line-height:1.55;margin:0 0 20px;color:#334155">${escapeHtml(message)}</p>
          ${href ? `<a href="${escapeHtml(href)}" style="display:inline-block;background:#f26a36;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open FoundIT</a>` : ''}
        </td></tr>
        <tr><td style="padding:16px 24px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0">
          You’re receiving this because you use FoundIT — Smart Lost &amp; Found.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/** Send one email. Returns true when Resend accepted it. Never throws. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey || !to) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') ?? 'FoundIT <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.warn('Resend rejected email:', res.status, (await res.text()).slice(0, 200))
    else await res.body?.cancel()
    return res.ok
  } catch (err) {
    console.warn('Email send failed:', err instanceof Error ? err.message : err)
    return false
  }
}
