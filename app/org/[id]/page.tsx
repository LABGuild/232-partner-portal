import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import type { Person } from '@/lib/types'
import { ORG_TYPE_LABELS, ORG_TYPE_COLORS } from '@/lib/types'

export default async function OrgPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('people')
    .select('platform_role, org_id')
    .eq('id', user.id)
    .single()

  // Fetch org with its expertise tags and watersheds
  const { data: org } = await supabase
    .from('organizations')
    .select(`
      *,
      org_expertise ( expertise_tags ( name, category ) ),
      org_watersheds ( watersheds ( name, state ) )
    `)
    .eq('id', params.id)
    .single()

  if (!org) notFound()

  const orgExpertise: Array<{ expertise_tags: { name: string } | null }> = org.org_expertise ?? []
  const orgWatersheds: Array<{ watersheds: { name: string } | null }> = org.org_watersheds ?? []

  // Fetch live people in this org with their expertise and watersheds
  const { data: people } = await supabase
    .from('people')
    .select(`
      *,
      person_expertise ( tag_id, expertise_tags ( name, category ) ),
      person_watersheds ( watershed_id, watersheds ( name, state ) )
    `)
    .eq('org_id', params.id)
    .eq('is_live', true)
    .order('last_name')

  const isAdmin = me?.platform_role === 'platform_admin'
  const isOrgAdmin = me?.platform_role === 'org_admin' && me?.org_id === params.id

  return (
    <div className="min-h-screen">
      <Nav role={me?.platform_role ?? 'user'} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Org header */}
        <div className="card p-6 mb-6">
          <div className="flex items-start gap-4">
            {org.logo_url && (
              <img
                src={org.logo_url}
                alt={`${org.name} logo`}
                className="w-16 h-16 object-contain rounded-lg flex-shrink-0 border border-gray-100"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="font-heading font-bold text-2xl text-gray-900">
                    {org.name}
                  </h1>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`tag ${ORG_TYPE_COLORS[org.type]}`}>
                      {ORG_TYPE_LABELS[org.type]}
                    </span>
                    {org.states?.map((s: string) => (
                      <span key={s} className="tag bg-gray-100 text-gray-600">{s}</span>
                    ))}
                  </div>
                </div>
                {(isAdmin || isOrgAdmin) && (
                  <a
                    href={`/org/${org.id}/edit`}
                    className="btn-secondary text-sm flex-shrink-0"
                  >
                    Edit org
                  </a>
                )}
              </div>

              {org.about_us ? (
                <p className="text-gray-600 mt-3 whitespace-pre-line">{org.about_us}</p>
              ) : org.description ? (
                <p className="text-gray-600 mt-3">{org.description}</p>
              ) : null}

              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-blue text-sm mt-2 hover:underline"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {org.website.replace(/^https?:\/\//, '')}
                </a>
              )}

              {/* Org expertise */}
              {orgExpertise.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {orgExpertise.map((oe, i) => oe.expertise_tags && (
                    <span key={i} className="tag bg-brand-blue/10 text-brand-blue text-xs">
                      {oe.expertise_tags.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Org watersheds */}
              {orgWatersheds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {orgWatersheds.map((ow, i) => ow.watersheds && (
                    <span key={i} className="tag bg-brand-green/10 text-brand-green text-xs">
                      📍 {ow.watersheds.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* People */}
        <h2 className="section-heading">
          People ({people?.length ?? 0})
        </h2>

        {!people || people.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <p>No active members listed yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {people.map((person: Person & {
              person_expertise: Array<{ expertise_tags: { name: string; category: string } }>
              person_watersheds: Array<{ watersheds: { name: string; state: string | null } }>
            }) => (
              <div key={person.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {person.photo_url ? (
                      <img
                        src={person.photo_url}
                        alt={`${person.first_name} ${person.last_name}`}
                        className="w-12 h-12 rounded-full object-cover border border-gray-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-400 font-heading flex-shrink-0">
                        {(person.first_name[0] ?? '') + (person.last_name[0] ?? '')}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-semibold text-gray-900">
                        {person.first_name} {person.last_name}
                      </h3>
                      {Array.isArray(person.engagement_level) && person.engagement_level.map((lvl: string) => (
                        <span key={lvl} className="tag bg-brand-yellow/20 text-gray-700 text-xs">
                          {lvl}
                        </span>
                      ))}
                    </div>
                    {person.title && (
                      <p className="text-gray-500 text-sm mt-0.5">{person.title}</p>
                    )}
                    {person.about_me && (
                      <p className="text-gray-600 text-sm mt-1.5 whitespace-pre-line">{person.about_me}</p>
                    )}

                    {/* Expertise tags */}
                    {person.person_expertise?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {person.person_expertise.map((pe) => (
                          <span
                            key={pe.expertise_tags.name}
                            className="tag bg-brand-blue/10 text-brand-blue text-xs"
                          >
                            {pe.expertise_tags.name}
                          </span>
                        ))}
                        {person.custom_expertise && (
                          <span className="tag bg-brand-green/10 text-brand-green text-xs">
                            {person.custom_expertise}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Watersheds */}
                    {person.person_watersheds?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {person.person_watersheds.map((pw) => (
                          <span
                            key={pw.watersheds.name}
                            className="tag bg-gray-100 text-gray-500 text-xs"
                          >
                            📍 {pw.watersheds.name}
                          </span>
                        ))}
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Contact — email/phone only if the partner opted in */}
                  <div className="flex flex-col gap-1.5 text-right flex-shrink-0 items-end">
                    {person.show_email && person.email && (
                      <a
                        href={`mailto:${person.email}`}
                        className="text-brand-blue text-sm hover:underline break-all"
                      >
                        {person.email}
                      </a>
                    )}
                    {person.show_email && person.phone && (
                      <a
                        href={`tel:${person.phone}`}
                        className="text-gray-500 text-sm hover:underline"
                      >
                        {person.phone}
                      </a>
                    )}
                    {person.linkedin_url && (
                      <a
                        href={person.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue text-sm hover:underline"
                      >
                        LinkedIn ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
