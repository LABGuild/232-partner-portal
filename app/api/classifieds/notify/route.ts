import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Sends a moderation-notification email when a Classified is submitted.
// No-ops gracefully if email env vars aren't configured yet, so the post
// flow never breaks. Configure RESEND_API_KEY + MODERATION_INBOX to enable.
export async function POST(request: Request) {
  try {
    const { classifiedId } = await request.json()
    if (!classifiedId) {
      return NextResponse.json({ ok: false, reason: 'missing id' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    const to = process.env.MODERATION_INBOX
    const from = process.env.EMAIL_FROM || 'noreply@forestguild.org'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://232-partner-portal.vercel.app'

    // Email not configured — skip silently. The post is already in the queue.
    if (!apiKey || !to) {
      return NextResponse.json({ ok: true, emailed: false, reason: 'email not configured' })
    }

    const supabase = createClient()
    const { data: c } = await supabase
      .from('classifieds')
      .select(`
        id, project_type_writein, details,
        person:people ( first_name, last_name, email ),
        project_type:project_types ( name )
      `)
      .eq('id', classifiedId)
      .single()

    if (!c) {
      return NextResponse.json({ ok: true, emailed: false, reason: 'not found' })
    }

    const person = Array.isArray(c.person) ? c.person[0] : c.person
    const projectType = Array.isArray(c.project_type) ? c.project_type[0] : c.project_type
    const posterName = person ? `${person.first_name} ${person.last_name}` : 'A partner'
    const projName = projectType?.name ?? c.project_type_writein ?? 'a project'
    const queueUrl = `${siteUrl}/admin/classifieds`

    const html = `
      <p>A new Classified was submitted to the 2-3-2 Partner Portal and is awaiting review.</p>
      <p><strong>From:</strong> ${posterName}${person?.email ? ` (${person.email})` : ''}<br/>
      <strong>Project type:</strong> ${projName}</p>
      ${c.details ? `<p><strong>Details:</strong><br/>${String(c.details).replace(/\n/g, '<br/>')}</p>` : ''}
      <p><a href="${queueUrl}">Open the moderation queue</a> to approve or archive it.</p>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `New Classified pending review — ${projName}`,
        html,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ ok: true, emailed: false, reason: text })
    }

    return NextResponse.json({ ok: true, emailed: true })
  } catch (err) {
    // Never block the submit flow on email problems.
    return NextResponse.json({ ok: true, emailed: false, reason: String(err) })
  }
}
