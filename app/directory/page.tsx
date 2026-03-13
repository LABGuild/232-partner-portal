import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/Nav'
import OrgCard from '@/components/OrgCard'
import type { Organization, OrgType } from '@/lib/types'
import { ORG_TYPE_LABELS } from '@/lib/types'

const ORG_TYPES: OrgType[] = ['NGO', 'Agency', 'Tribal', 'Academic', 'Contractor']

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: { type?: string; search?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get current user's role
  const { data: me } = await supabase
    .from('people')
    .select('platform_role')
    .eq('id', user.id)
    .single()

  // Fetch live orgs
  let query = supabase
    .from('organizations')
    .select('*')
    .eq('is_live', true)
    .order('name')

  if (searchParams.type) {
    query = query.eq('type', searchParams.type)
  }

  const { data: orgs } = await query

  // Filter by search term (client-side for now)
  const search = searchParams.search?.toLowerCase() ?? ''
  const filtered = (orgs ?? []).filter((org: Organization) =>
    !search || org.name.toLowerCase().includes(search)
  )

  // Get people counts per org
  const { data: counts } = await supabase
    .from('people')
    .select('org_id')
    .eq('is_live', true)
    .in('org_id', filtered.map((o: Organization) => o.id))

  const countMap: Record<string, number> = {}
  ;(counts ?? []).forEach((p: { org_id: string }) => {
    countMap[p.org_id] = (countMap[p.org_id] ?? 0) + 1
  })

  const activeType = searchParams.type as OrgType | undefined

  return (
    <div className="min-h-screen">
      <Nav role={me?.platform_role ?? 'user'} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="font-heading font-bold text-2xl text-brand-blue">
            Partner Directory
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} organization{filtered.length !== 1 ? 's' : ''} in the network
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <form method="GET" className="flex-1">
            <input
              type="text"
              name="search"
              defaultValue={searchParams.search}
              placeholder="Search organizations…"
              className="input"
            />
            {searchParams.type && (
              <input type="hidden" name="type" value={searchParams.type} />
            )}
          </form>

          {/* Type filter */}
          <div className="flex flex-wrap gap-2">
            <a
              href="/directory"
              className={`tag cursor-pointer transition-colors ${
                !activeType
                  ? 'bg-brand-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </a>
            {ORG_TYPES.map(type => (
              <a
                key={type}
                href={`/directory?type=${type}${search ? `&search=${search}` : ''}`}
                className={`tag cursor-pointer transition-colors ${
                  activeType === type
                    ? 'bg-brand-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'NGO' ? 'NGO' : ORG_TYPE_LABELS[type].split(' ')[0]}
              </a>
            ))}
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="font-heading text-lg">No organizations found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((org: Organization) => (
              <OrgCard
                key={org.id}
                org={org}
                peopleCount={countMap[org.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
