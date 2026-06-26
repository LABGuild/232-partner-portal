import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { buildClassifiedSentence } from '@/lib/types'
import type { HaveNeedType, LandOwnership } from '@/lib/types'

export const dynamic = 'force-dynamic'

type SearchParams = {
  category?: string
  watershed?: string
  have?: string
  need?: string
  submitted?: string
}

export default async function ClassifiedsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('people').select('platform_role').eq('id', user.id).single()

  const [watershedsRes, typesRes] = await Promise.all([
    supabase.from('watersheds').select('id, name, state').order('sort_order'),
    supabase.from('project_types').select('category').order('sort_order'),
  ])
  const watersheds = watershedsRes.data ?? []
  const watershedName: Record<string, string> = {}
  watersheds.forEach((w: { id: string; name: string }) => { watershedName[w.id] = w.name })

  const categories = Array.from(
    new Set((typesRes.data ?? []).map((t: { category: string }) => t.category))
  )

  // Build query
  let query = supabase
    .from('classifieds')
    .select(`
      *,
      person:people ( first_name, last_name, organizations ( name ) ),
      project_type:project_types ( name, category )
    `)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })

  if (searchParams.have)      query = query.eq('have_type', searchParams.have)
  if (searchParams.need)      query = query.eq('need_type', searchParams.need)
  if (searchParams.watershed) query = query.contains('watershed_ids', [searchParams.watershed])

  const { data: rawList } = await query

  // Category filter (joined column — filtered here for simplicity)
  const list = (rawList ?? []).filter((c: { project_type?: { category?: string } | null }) =>
    !searchParams.category || c.project_type?.category === searchParams.category
  )

  return (
    <div className="min-h-screen">
      <Nav role={me?.platform_role ?? 'user'} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="font-heading font-bold text-2xl text-brand-blue">Classifieds</h1>
            <p className="text-gray-500 text-sm mt-1">
              {list.length} open post{list.length !== 1 ? 's' : ''} — partners looking to connect on projects.
            </p>
          </div>
          <Link href="/classifieds/new" className="btn-primary flex-shrink-0">Post a Classified</Link>
        </div>

        {searchParams.submitted === '1' && (
          <div className="card p-4 mb-6 bg-brand-green/10 border-brand-green/30">
            <p className="text-sm text-gray-800">
              ✓ Thanks! Your Classified was submitted and is awaiting review by Guild staff.
              You&apos;ll see it here once it&apos;s approved.
            </p>
          </div>
        )}

        {/* Filters */}
        <form method="GET" className="card p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Project category</label>
            <select name="category" defaultValue={searchParams.category ?? ''} className="input">
              <option value="">All categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Watershed</label>
            <select name="watershed" defaultValue={searchParams.watershed ?? ''} className="input">
              <option value="">All watersheds</option>
              {watersheds.map((w: { id: string; name: string }) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Has</label>
            <select name="have" defaultValue={searchParams.have ?? ''} className="input capitalize">
              <option value="">Any</option>
              <option value="funding">Funding</option>
              <option value="capacity">Capacity</option>
              <option value="expertise">Expertise</option>
            </select>
          </div>
          <div className="flex gap-2">
            <select name="need" defaultValue={searchParams.need ?? ''} className="input capitalize" aria-label="Needs">
              <option value="">Needs: Any</option>
              <option value="funding">Needs: Funding</option>
              <option value="capacity">Needs: Capacity</option>
              <option value="expertise">Needs: Expertise</option>
            </select>
            <button type="submit" className="btn-primary px-4">Filter</button>
          </div>
        </form>

        {(searchParams.category || searchParams.watershed || searchParams.have || searchParams.need) && (
          <div className="mb-4">
            <Link href="/classifieds" className="text-brand-blue text-sm hover:underline">× Clear filters</Link>
          </div>
        )}

        {/* Results */}
        {list.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="font-heading text-lg">No Classifieds yet</p>
            <p className="text-sm mt-1">Be the first to post one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {list.map((c: {
              id: string
              have_type: HaveNeedType
              need_type: HaveNeedType
              land_ownership: LandOwnership
              watershed_ids: string[]
              project_type_writein: string | null
              created_at: string
              person?: { first_name: string; last_name: string; organizations?: { name: string } | { name: string }[] | null } | null
              project_type?: { name: string; category: string } | null
            }) => {
              const personName = c.person ? `${c.person.first_name} ${c.person.last_name}` : 'A partner'
              const org = Array.isArray(c.person?.organizations)
                ? c.person?.organizations[0]
                : c.person?.organizations
              const projName = c.project_type?.name ?? c.project_type_writein ?? ''
              const wsNames = (c.watershed_ids ?? []).map(id => watershedName[id]).filter(Boolean)
              const sentence = buildClassifiedSentence({
                name: personName,
                watershedNames: wsNames,
                haveType: c.have_type,
                projectTypeName: projName,
                landOwnership: c.land_ownership,
                needType: c.need_type,
              })
              const posted = new Date(c.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
              return (
                <Link key={c.id} href={`/classifieds/${c.id}`}>
                  <div className="card p-5 h-full flex flex-col gap-3 cursor-pointer">
                    <p className="text-gray-800 leading-relaxed">{sentence}</p>
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      {projName && (
                        <span className="tag bg-brand-blue/10 text-brand-blue text-xs">{projName}</span>
                      )}
                      {wsNames.map(n => (
                        <span key={n} className="tag bg-brand-green/10 text-brand-green text-xs">📍 {n}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-400">
                      <span>{personName}{org?.name ? ` · ${org.name}` : ''}</span>
                      <span>{posted}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
