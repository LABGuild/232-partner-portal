'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import { ENGAGEMENT_LEVELS } from '@/lib/types'
import type { Organization, ExpertiseTag, Watershed, PlatformRole } from '@/lib/types'

function ProfilePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isSetup = searchParams.get('setup') === 'true'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auth
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [role, setRole] = useState<PlatformRole>('user')

  // Reference data
  const [orgs, setOrgs] = useState<Pick<Organization, 'id' | 'name' | 'type'>[]>([])
  const [expertiseTags, setExpertiseTags] = useState<ExpertiseTag[]>([])
  const [watersheds, setWatersheds] = useState<Watershed[]>([])

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [orgId, setOrgId] = useState<string>('')
  const [orgSearch, setOrgSearch] = useState('')
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const [selectedEngagementLevels, setSelectedEngagementLevels] = useState<Set<string>>(new Set())
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedWatersheds, setSelectedWatersheds] = useState<Set<string>>(new Set())
  const [customExpertise, setCustomExpertise] = useState('')
  const [customWatershed, setCustomWatershed] = useState('')
  const [isLive, setIsLive] = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setUserId(user.id)
    setUserEmail(user.email ?? '')

    const [orgsRes, tagsRes, watershedsRes, personRes, tagSelRes, wsSelRes] =
      await Promise.all([
        supabase.from('organizations').select('id, name, type').order('name'),
        supabase.from('expertise_tags').select('*').order('sort_order'),
        supabase.from('watersheds').select('*').order('sort_order'),
        supabase.from('people').select('*').eq('id', user.id).single(),
        supabase.from('person_expertise').select('tag_id').eq('person_id', user.id),
        supabase.from('person_watersheds').select('watershed_id').eq('person_id', user.id),
      ])

    setOrgs(orgsRes.data ?? [])
    setExpertiseTags(tagsRes.data ?? [])
    setWatersheds(watershedsRes.data ?? [])

    if (personRes.data) {
      const p = personRes.data
      setFirstName(p.first_name ?? '')
      setLastName(p.last_name ?? '')
      setPhone(p.phone ?? '')
      setTitle(p.title ?? '')
      setOrgId(p.org_id ?? '')
      setSelectedEngagementLevels(new Set(Array.isArray(p.engagement_level) ? p.engagement_level : []))
      setCustomExpertise(p.custom_expertise ?? '')
      setCustomWatershed(p.custom_watershed ?? '')
      setIsLive(p.is_live ?? false)
      setRole(p.platform_role ?? 'user')
    } else {
      // New user — pre-fill name from email
      const emailName = (user.email ?? '').split('@')[0]
      const parts = emailName.split('.')
      if (parts.length >= 2) {
        setFirstName(parts[0].charAt(0).toUpperCase() + parts[0].slice(1))
        setLastName(parts[1].charAt(0).toUpperCase() + parts[1].slice(1))
      }
    }

    setSelectedTags(new Set((tagSelRes.data ?? []).map((r: { tag_id: string }) => r.tag_id)))
    setSelectedWatersheds(new Set((wsSelRes.data ?? []).map((r: { watershed_id: string }) => r.watershed_id)))
    setLoading(false)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  // Org autocomplete helpers
  const selectedOrg = orgs.find(o => o.id === orgId)
  const orgDisplayValue = orgSearch !== '' ? orgSearch : (selectedOrg ? selectedOrg.name : '')
  const filteredOrgs = orgSearch
    ? orgs.filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase())).slice(0, 8)
    : []
  const showOrgDropdown = orgDropdownOpen && orgSearch.length > 0

  const toggleEngagement = (level: string) => {
    setSelectedEngagementLevels(prev => {
      const next = new Set(prev)
      next.has(level) ? next.delete(level) : next.add(level)
      return next
    })
  }

  const toggleTag = (id: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleWatershed = (id: string) => {
    setSelectedWatersheds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setError(null)

    const supabase = createClient()

    const { error: personError } = await supabase
      .from('people')
      .upsert({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email: userEmail,
        phone: phone || null,
        title: title || null,
        org_id: orgId || null,
        engagement_level: Array.from(selectedEngagementLevels),
        custom_expertise: customExpertise || null,
        custom_watershed: customWatershed || null,
        is_live: isLive,
      })

    if (personError) {
      setError(personError.message)
      setSaving(false)
      return
    }

    // Replace expertise tags
    await supabase.from('person_expertise').delete().eq('person_id', userId)
    if (selectedTags.size > 0) {
      await supabase.from('person_expertise').insert(
        Array.from(selectedTags).map(tag_id => ({ person_id: userId, tag_id }))
      )
    }

    // Replace watersheds
    await supabase.from('person_watersheds').delete().eq('person_id', userId)
    if (selectedWatersheds.size > 0) {
      await supabase.from('person_watersheds').insert(
        Array.from(selectedWatersheds).map(watershed_id => ({ person_id: userId, watershed_id }))
      )
    }

    // Save write-in expertise if provided
    if (customExpertise) {
      await supabase.from('custom_expertise_writeins').upsert({
        person_id: userId,
        text: customExpertise,
      })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)

    if (isSetup) router.push('/directory')
  }

  // Group expertise tags by category
  const tagsByCategory = expertiseTags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = []
    acc[tag.category].push(tag)
    return acc
  }, {} as Record<string, ExpertiseTag[]>)

  // Group watersheds — null state = entire landscape
  const watershedsByGroup: Record<string, Watershed[]> = {
    'Colorado Watersheds': watersheds.filter(w => w.state === 'CO'),
    'New Mexico Watersheds': watersheds.filter(w => w.state === 'NM'),
    'The entire 2-3-2 landscape': watersheds.filter(w => !w.state),
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 font-heading">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Nav role={role} />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-heading font-bold text-2xl text-brand-blue">
            {isSetup ? 'Set up your profile' : 'My Profile'}
          </h1>
          {isSetup && (
            <p className="text-gray-500 text-sm mt-1">
              Welcome to the 2-3-2 Partnership Database! Fill out your profile so other partners can find you.
            </p>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">

          {/* ── Basic info ── */}
          <div className="card p-5 space-y-4">
            <h2 className="section-heading">Your information</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="input bg-gray-50 text-gray-500 cursor-not-allowed" value={userEmail} disabled />
              <p className="text-xs text-gray-400 mt-1">Email is set by your sign-in and cannot be changed here.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title / Role</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Forest Restoration Program Manager" />
            </div>

            {/* Org autocomplete */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
              <div className="relative">
                <input
                  className="input pr-8"
                  value={orgDisplayValue}
                  onChange={e => {
                    setOrgSearch(e.target.value)
                    setOrgId('')
                    setOrgDropdownOpen(true)
                  }}
                  onFocus={() => { if (!orgId) setOrgDropdownOpen(true) }}
                  onBlur={() => setTimeout(() => { setOrgDropdownOpen(false); setOrgSearch('') }, 150)}
                  placeholder="Type to search organizations…"
                  autoComplete="off"
                />
                {orgId && (
                  <button
                    type="button"
                    onClick={() => { setOrgId(''); setOrgSearch('') }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl leading-none"
                    aria-label="Clear organization"
                  >
                    ×
                  </button>
                )}
                {showOrgDropdown && filteredOrgs.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {filteredOrgs.map(org => (
                      <button
                        key={org.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-brand-blue/5 text-sm border-b border-gray-50 last:border-0"
                        onMouseDown={() => {
                          setOrgId(org.id)
                          setOrgSearch('')
                          setOrgDropdownOpen(false)
                        }}
                      >
                        {org.name}
                      </button>
                    ))}
                  </div>
                )}
                {showOrgDropdown && orgSearch && filteredOrgs.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2.5 text-sm text-gray-400">
                    No organizations found
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Engagement ── */}
          <div className="card p-5 space-y-3">
            <h2 className="section-heading">Your role in the 2-3-2 Partnership</h2>
            <p className="text-sm text-gray-500 -mt-2">Select all that apply — you can pick more than one.</p>
            <div className="flex flex-wrap gap-2">
              {ENGAGEMENT_LEVELS.map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleEngagement(level)}
                  className={`tag cursor-pointer transition-colors ${
                    selectedEngagementLevels.has(level)
                      ? 'bg-brand-yellow text-gray-900 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* ── Expertise ── */}
          <div className="card p-5 space-y-4">
            <h2 className="section-heading">Areas of expertise</h2>
            <p className="text-sm text-gray-500 -mt-2">Select all that apply to your work.</p>

            {Object.entries(tagsByCategory).map(([category, tags]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{category}</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`tag cursor-pointer transition-colors ${
                        selectedTags.has(tag.id)
                          ? 'bg-brand-blue text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional expertise (write in)
              </label>
              <input
                className="input"
                value={customExpertise}
                onChange={e => setCustomExpertise(e.target.value)}
                placeholder="e.g. Prescribed burn management"
              />
              <p className="text-xs text-gray-400 mt-1">
                If 3+ partners add the same skill, we&apos;ll add it to the list for everyone.
              </p>
            </div>
          </div>

          {/* ── Geographic focus ── */}
          <div className="card p-5 space-y-4">
            <h2 className="section-heading">Where do you work?</h2>
            <p className="text-sm text-gray-500 -mt-2">
              Select all the landscapes and watersheds where you do restoration work.
            </p>

            {Object.entries(watershedsByGroup).map(([group, ws]) => (
              ws.length > 0 && (
                <div key={group}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {ws.map(w => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleWatershed(w.id)}
                        className={`tag cursor-pointer transition-colors ${
                          selectedWatersheds.has(w.id)
                            ? 'bg-brand-green text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        📍 {w.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Other watershed (write in)
              </label>
              <input
                className="input"
                value={customWatershed}
                onChange={e => setCustomWatershed(e.target.value)}
                placeholder="e.g. Arroyo Hondo, Costilla Creek…"
              />
              <p className="text-xs text-gray-400 mt-1">
                If your primary watershed isn&apos;t listed above, write it in here.
              </p>
            </div>
          </div>

          {/* ── Go live ── */}
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <input
                id="is_live"
                type="checkbox"
                checked={isLive}
                onChange={e => setIsLive(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-blue"
              />
              <div>
                <label htmlFor="is_live" className="font-heading font-semibold text-gray-900 cursor-pointer">
                  Show my profile in the directory
                </label>
                <p className="text-sm text-gray-500 mt-0.5">
                  Check this when your profile is ready. You can uncheck it at any time.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-brand-red text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full text-base py-3"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : isSetup ? 'Save and go to directory →' : 'Save profile'}
          </button>

        </form>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 font-heading">Loading…</div>
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  )
}
