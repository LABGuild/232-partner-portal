// Shared email sender (Resend). Stays dormant until RESEND_API_KEY is set,
// so notification flows never break before email is configured.
//
// To enable email, add these in Vercel → Project → Settings → Environment Variables:
//   RESEND_API_KEY   (from resend.com)
//   EMAIL_FROM       (optional, defaults to noreply@forestguild.org)

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'noreply@forestguild.org'

  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean)
  if (!apiKey || recipients.length === 0) {
    return { sent: false, reason: 'email not configured' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: recipients, subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) {
      return { sent: false, reason: await res.text() }
    }
    return { sent: true }
  } catch (err) {
    return { sent: false, reason: String(err) }
  }
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://232-partner-portal.vercel.app'
}
