import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, siteUrl } from '@/lib/email'

// Matching rules (blueprint Section 6):
//   Complementary = same project category + OVERLAPPING watershed +
//                   one partner's "have" fits the other's "need"
//   Parallel      = same project category + SAME have/need +
//                   DIFFERENT watershed (potential co-applicants)
//   Score: project type overlap (primary) + watershed (secondary)
//
// Runs when a moderator approves a Classified. Refreshes that post's
// matches and emails partners who are newly matched (email is dormant
// until RESEND_API_KEY is configured).

type Row = {
  id: string
  person_id: string
  have_type: string
  need_type: string
  project_type_id: string | null
  project_type_writein: string | null
  watershed_ids: string[] | null
  person: { first_name: string; last_name: string; email: string | null }
    | { first_name: string; last_name: string; email: string | null }[] | null
  project_type: { name: string; category: string } | { name: string; category: string }[] | null
}

const SELECT = `
  id, person_id, have_type, need_type, project_type_id, project_type_writein, watershed_ids,
  person:people ( first_name, last_name, email ),
  project_type:project_types ( name, category )
`

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function categoryOf(r: Row): string | null {
  return one(r.project_type)?.category ?? null
}

function overlapCount(a: string[] | null, b: string[] | null): number {
  const setB = new Set(b ?? [])
  return (a ?? []).filter(x => setB.has(x)).length
}

export async function POST(request: Request) {
  try {
    const { classifiedId } = await request.json()
    if (!classifiedId) {
      return NextResponse.json({ ok: false, reason: 'missing id' }, { status: 400 })
    }

    const supabase = createClient()

    // Only moderators/admins may run matching
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 })
    const { data: me } = await supabase
      .from('people').select('platform_role').eq('id', user.id).single()
    const role = me?.platform_role
    if (role !== 'moderator' && role !== 'platform_admin') {
      return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })
    }

    // The post being matched (must be approved)
    const { data: aData } = await supabase
      .from('classifieds').select(SELECT).eq('id', classifiedId).single()
    const A = aData as Row | null
    if (!A) return NextResponse.json({ ok: false, reason: 'not found' }, { status: 404 })

    const aCategory = categoryOf(A)

    // All other approved posts
    const { data: othersData } = await supabase
      .from('classifieds').select(SELECT).eq('moderation_status', 'approved').neq('id', A.id)
    const others = (othersData ?? []) as Row[]

    // Who was already matched with A (to avoid re-emailing on re-runs)?
    const { data: existing } = await supabase
      .from('matches').select('classified_id_a, classified_id_b')
      .or(`classified_id_a.eq.${A.id},classified_id_b.eq.${A.id}`)
    const previouslyMatched = new Set<string>()
    ;(existing ?? []).forEach((m: { classified_id_a: string; classified_id_b: string }) => {
      previouslyMatched.add(m.classified_id_a === A.id ? m.classified_id_b : m.classified_id_a)
    })

    type Pair = {
      classified_id_a: string
      classified_id_b: string
      match_type: 'complementary' | 'parallel'
      match_score: number
      other: Row
    }
    const pairs: Pair[] = []

    for (const B of others) {
      if (B.person_id === A.person_id) continue            // not your own posts
      const bCategory = categoryOf(B)
      if (!aCategory || !bCategory || aCategory !== bCategory) continue

      const overlap = overlapCount(A.watershed_ids, B.watershed_ids)
      const fits = A.have_type === B.need_type || A.need_type === B.have_type
      const same = A.have_type === B.have_type && A.need_type === B.need_type

      let type: 'complementary' | 'parallel' | null = null
      if (fits && overlap > 0) type = 'complementary'
      else if (same && overlap === 0) type = 'parallel'
      if (!type) continue

      const sameProjectType = !!A.project_type_id && A.project_type_id === B.project_type_id
      const projComponent = sameProjectType ? 0.6 : 0.3
      const wsComponent = type === 'complementary' ? (overlap >= 2 ? 0.4 : 0.2) : 0.2
      const score = Math.min(1, Number((projComponent + wsComponent).toFixed(2)))

      const [idA, idB] = A.id < B.id ? [A.id, B.id] : [B.id, A.id]
      pairs.push({
        classified_id_a: idA,
        classified_id_b: idB,
        match_type: type,
        match_score: score,
        other: B,
      })
    }

    // Refresh A's matches: clear then re-insert
    await supabase.from('matches').delete()
      .or(`classified_id_a.eq.${A.id},classified_id_b.eq.${A.id}`)

    if (pairs.length > 0) {
      await supabase.from('matches').upsert(
        pairs.map(p => ({
          classified_id_a: p.classified_id_a,
          classified_id_b: p.classified_id_b,
          match_type: p.match_type,
          match_score: p.match_score,
        })),
        { onConflict: 'classified_id_a,classified_id_b' }
      )
    }

    // Email partners who are newly matched (dormant if email unconfigured)
    const newPairs = pairs.filter(p => !previouslyMatched.has(p.other.id))
    let emailed = 0
    if (newPairs.length > 0 && process.env.RESEND_API_KEY) {
      const aPerson = one(A.person)
      const aProj = one(A.project_type)?.name ?? A.project_type_writein ?? 'your project'

      // Notify A's poster once
      if (aPerson?.email) {
        const r = await sendEmail({
          to: aPerson.email,
          subject: `We found a partner who might be a good fit for your ${aProj} project!`,
          html: matchEmailHtml(aPerson.first_name, `${siteUrl()}/classifieds/${A.id}`),
        })
        if (r.sent) emailed++
      }

      // Notify each newly matched partner once
      for (const p of newPairs) {
        const bPerson = one(p.other.person)
        const bProj = one(p.other.project_type)?.name ?? p.other.project_type_writein ?? 'your project'
        if (bPerson?.email) {
          const r = await sendEmail({
            to: bPerson.email,
            subject: `We found a partner who might be a good fit for your ${bProj} project!`,
            html: matchEmailHtml(bPerson.first_name, `${siteUrl()}/classifieds/${p.other.id}`),
          })
          if (r.sent) emailed++
        }
      }
    }

    return NextResponse.json({ ok: true, matches: pairs.length, newMatches: newPairs.length, emailed })
  } catch (err) {
    return NextResponse.json({ ok: false, reason: String(err) }, { status: 500 })
  }
}

function matchEmailHtml(firstName: string, link: string): string {
  return `
    <p>Hi ${firstName || 'there'},</p>
    <p>A new match has surfaced for your Classified on the 2-3-2 Partner Portal.
    Log in to view the details and connect.</p>
    <p><a href="${link}">View your Classified and its matches</a></p>
  `
}
