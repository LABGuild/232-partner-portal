import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import ClassifiedActions from '@/components/ClassifiedActions'
import { buildClassifiedSentence } from '@/lib/types'
import type { HaveNeedType, LandOwnership, ContactPreference } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ClassifiedDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('people').select('platform_role').eq('id', user.id).single()
  const role = me?.platform_role ?? 'user'
  const isModerator = role === 'moderator' || role === 'platform_admin'

  const { data: c } = await supabase
    .from('classifieds')
    .select(`
      *,
      person:people ( first_name, last_name, email, phone, organizations ( name, id ) ),
      project_type:project_types ( name, category )
    `)
    .eq('id', params.id)
    .single()

  if (!c) notFound()

  const { data: watersheds } = await supabase
    .from('watersheds').select('id, name').order('sort_order')
  const watershedName: Record<string, string> = {}
  ;(watersheds ?? []).forEach((w: { id: string; name: string }) => { watershedName[w.id] = w.name })

  const person = (Array.isArray(c.person) ? c.person[0] : c.person) as {
    first_name: string; last_name: string; email: string | null; phone: string | null
    organizations: { name: string; id: string } | { name: string; id: string }[] | null
  } | null
  const org = Array.isArray(person?.organizations) ? person?.organizations[0] : person?.organizations
  const projectType = (Array.isArray(c.project_type) ? c.project_type[0] : c.project_type) as
    { name: string; category: string } | null

  const personName = person ? `${person.first_name} ${person.last_name}` : 'A partner'
  const projName = projectType?.name ?? c.project_type_writein ?? ''
  const wsNames = ((c.watershed_ids as string[]) ?? []).map(id => watershedName[id]).filter(Boolean)

  const sentence = buildClassifiedSentence({
    name: personName,
    watershedNames: wsNames,
    haveType: c.have_type as HaveNeedType,
    projectTypeName: projName,
    landOwnership: c.land_ownership as LandOwnership,
    needType: c.need_type as HaveNeedType,
  })

  const isOwner = c.person_id === user.id
  const status = c.moderation_status as string
  const contactPref = c.contact_preference as ContactPreference

  // Contact is revealed to confirmed matches (Phase 3). For now, the poster and
  // moderators can see it; everyone else sees a note.
  const canSeeContact = isOwner || isModerator
  const posted = new Date(c.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-screen">
      <Nav role={role} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/classifieds" className="text-brand-blue text-sm hover:underline">← Back to Classifieds</Link>

        {/* Status banner for owner */}
        {isOwner && status !== 'approved' && (
          <div className={`card p-3 mt-4 ${status === 'pending' ? 'bg-brand-yellow/15 border-brand-yellow/40' : 'bg-gray-100'}`}>
            <p className="text-sm text-gray-700">
              {status === 'pending'
                ? '⏳ This Classified is awaiting review by Guild staff. Only you can see it until it’s approved.'
                : '📦 This Classified has been archived and is no longer shown in the browse list.'}
            </p>
          </div>
        )}

        {/* Main */}
        <div className="card p-6 mt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {projName && <span className="tag bg-brand-blue/10 text-brand-blue">{projName}</span>}
              {wsNames.map(n => (
                <span key={n} className="tag bg-brand-green/10 text-brand-green">📍 {n}</span>
              ))}
            </div>
            {isOwner && <ClassifiedActions classifiedId={c.id} />}
          </div>

          <p className="text-lg text-gray-900 leading-relaxed mt-4">{sentence}</p>

          <p className="text-xs text-gray-400 mt-3">
            Posted by {personName}{org?.name ? ` · ${org.name}` : ''} · {posted}
          </p>

          {c.details && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <h2 className="section-heading">More details</h2>
              <p className="text-gray-700 whitespace-pre-line">{c.details}</p>
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="card p-6 mt-4">
          <h2 className="section-heading">Contact</h2>
          {canSeeContact ? (
            <div className="text-sm">
              {contactPref === 'phone' ? (
                person?.phone
                  ? <a href={`tel:${person.phone}`} className="text-brand-blue hover:underline">{person.phone}</a>
                  : <span className="text-gray-400">No phone number on file — add one in your profile.</span>
              ) : (
                person?.email
                  ? <a href={`mailto:${person.email}`} className="text-brand-blue hover:underline break-all">{person.email}</a>
                  : <span className="text-gray-400">No email on file.</span>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {isOwner
                  ? 'This is how confirmed matches will reach you.'
                  : 'Visible to you as a moderator.'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {personName.split(' ')[0]}&apos;s contact info is shared with confirmed matches.
              Matching runs after a post is approved — you&apos;ll be notified if you&apos;re a fit.
            </p>
          )}
        </div>

        {/* Matches (Phase 3) */}
        <div className="card p-6 mt-4">
          <h2 className="section-heading">Matches</h2>
          <p className="text-sm text-gray-500">
            Automatic matching — complementary partners and potential co-applicants — will appear
            here. This is coming in the next phase of the portal.
          </p>
        </div>
      </div>
    </div>
  )
}
