'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import type { Organization, ExpertiseTag, Watershed, EngagementLevel, PlatformRole } from '@/lib/types'

const ENGAGEMENT_LEVELS: EngagementLevel[] = [
  'Core partner',
  'Active participant',
  'Subscriber',
]

export default function ProfilePage() {
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
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [expertiseTags, setExpertiseTags] = useState<ExpertiseTag[]>([])
  const [watersheds, setWatersheds] = useState<Watershed[]>([])

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [orgId, setOrgId] = useState<string>('')
  const [engagementLevel, setEngagementLevel] = useState<EngagementLevel | ''>('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedWatersheds, setSelectedWatersheds] = useState<Set<string>>(new Set())
  const [customExpertise, setCustomExpertise] = useState('')
  const [isLive, setIsLive] = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setUserId(user.id)
    setUserEmail(user.email ?? '')

    const [orgsRes, tagsRes, watershedsRes, personRes, tagSelRes, wsSelRes] =
      await Promise.all([
        supabase.from('organizations').select('id, name, type').eq('is_live', true).order('name'),
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
      setEngagementLevel(p.engagement_level ?? '')
      setCustomExpertise(p.custom_expertise ?? '')
      setIsLive(p.is_live ?? false)
      setRole(p.platform_role ?? 'user')
    } else {
      // New user — pre-fill email parts
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

    // Upsert person record
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
        engagement_level: engagementLevel || null,
        custom_expertise: customExpertise || null,
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

    // Save write-in if provided and new
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

  const watershedsByState = {
    'Colorado': watersheds.filter(w => w.state === 'CO'),
    'New Mexico': watersheds.filter(w => w.state === 'NM'),
    'Multi-state': watersheds.filter(w => !w.state),
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
              Welcome to the 232 Partner Portal! Fill out your profile so other partners can find you.
            </p>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic info */}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
              <select className="input" value={orgId} onChange={e => setOrgId(e.target.value)}>
                <option value="">— Select your organization —</option>
                {orgs.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Engagement with the 232 Partnership
              </label>
              <select className="input" value={engagementLevel} onChange={e => setEngagementLevel(e.target.value as EngagementLevel)}>
                <option value="">— Select —</option>
                {ENGAGEMENT_LEVELS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Expertise */}
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

          {/* Watersheds */}
          <div className="card p-5 space-y-4">
            <h2 className="section-heading">Geographic focus</h2>
            <p className="text-sm text-gray-500 -mt-2">Which watersheds do you work in?</p>

            {Object.entries(watershedsByState).map(([state, ws]) => (
              <div key={state}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{state}</p>
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
            ))}
          </div>

          {/* Go live */}
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
