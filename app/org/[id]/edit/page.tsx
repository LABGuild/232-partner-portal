'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import type { OrgType, PlatformRole, ExpertiseTag, Watershed } from '@/lib/types'
import { ORG_TYPE_LABELS } from '@/lib/types'

const ORG_TYPES: OrgType[] = ['NGO', 'Agency', 'Tribal', 'Academic', 'Contractor']

export default function OrgEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<PlatformRole>('user')

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<OrgType>('NGO')
  const [states, setStates] = useState<Set<string>>(new Set())
  const [website, setWebsite] = useState('')
  const [description, setDescription] = useState('')
  const [aboutUs, setAboutUs] = useState('')
  const [isLive, setIsLive] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Reference data + selections
  const [expertiseTags, setExpertiseTags] = useState<ExpertiseTag[]>([])
  const [watersheds, setWatersheds] = useState<Watershed[]>([])
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedWatersheds, setSelectedWatersheds] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: me } = await supabase
      .from('people')
      .select('platform_role, org_id')
      .eq('id', user.id)
      .single()

    const myRole: PlatformRole = me?.platform_role ?? 'user'
    setRole(myRole)

    // Only platform_admin or this org's org_admin can edit
    const canEdit =
      myRole === 'platform_admin' ||
      (myRole === 'org_admin' && me?.org_id === params.id)

    if (!canEdit) {
      router.push(`/org/${params.id}`)
      return
    }

    const [orgRes, tagsRes, watershedsRes, orgTagsRes, orgWsRes] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', params.id).single(),
      supabase.from('expertise_tags').select('*').order('sort_order'),
      supabase.from('watersheds').select('*').order('sort_order'),
      supabase.from('org_expertise').select('tag_id').eq('org_id', params.id),
      supabase.from('org_watersheds').select('watershed_id').eq('org_id', params.id),
    ])

    const org = orgRes.data
    if (!org) { router.push('/directory'); return }

    setName(org.name ?? '')
    setType(org.type ?? 'NGO')
    setStates(new Set(org.states ?? []))
    setWebsite(org.website ?? '')
    setDescription(org.description ?? '')
    setAboutUs(org.about_us ?? '')
    setLogoUrl(org.logo_url ?? '')
    setIsLive(org.is_live ?? false)

    setExpertiseTags(tagsRes.data ?? [])
    setWatersheds(watershedsRes.data ?? [])
    setSelectedTags(new Set((orgTagsRes.data ?? []).map((r: { tag_id: string }) => r.tag_id)))
    setSelectedWatersheds(new Set((orgWsRes.data ?? []).map((r: { watershed_id: string }) => r.watershed_id)))
    setLoading(false)
  }, [router, params.id])

  useEffect(() => { loadData() }, [loadData])

  const toggleState = (s: string) => {
    setStates(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    setError(null)

    const supabase = createClient()
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${params.id}/logo.${ext}`

    const { error: uploadError } = await supabase
      .storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError(uploadError.message)
      setUploadingLogo(false)
      return
    }

    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    setLogoUrl(`${data.publicUrl}?t=${Date.now()}`)
    setUploadingLogo(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        name,
        type,
        states: Array.from(states),
        website: website || null,
        description: description || null,
        about_us: aboutUs || null,
        logo_url: logoUrl ? logoUrl.split('?')[0] : null,
        is_live: isLive,
      })
      .eq('id', params.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Replace org expertise tags
    await supabase.from('org_expertise').delete().eq('org_id', params.id)
    if (selectedTags.size > 0) {
      await supabase.from('org_expertise').insert(
        Array.from(selectedTags).map(tag_id => ({ org_id: params.id, tag_id }))
      )
    }

    // Replace org watersheds
    await supabase.from('org_watersheds').delete().eq('org_id', params.id)
    if (selectedWatersheds.size > 0) {
      await supabase.from('org_watersheds').insert(
        Array.from(selectedWatersheds).map(watershed_id => ({ org_id: params.id, watershed_id }))
      )
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => router.push(`/org/${params.id}`), 1200)
  }

  // Group reference data for display
  const tagsByCategory = expertiseTags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = []
    acc[tag.category].push(tag)
    return acc
  }, {} as Record<string, ExpertiseTag[]>)

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
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Go back"
          >
            ←
          </button>
          <h1 className="font-heading font-bold text-2xl text-brand-blue">Edit Organization</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="card p-5 space-y-4">

            {/* Logo */}
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Organization logo"
                  className="w-20 h-20 object-contain rounded-lg border border-gray-200 flex-shrink-0 bg-white"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-300 flex-shrink-0">
                  No logo
                </div>
              )}
              <div>
                <label className="btn-secondary text-sm cursor-pointer inline-block">
                  {uploadingLogo ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={handleLogoUpload}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-1">PNG or JPG. A transparent PNG looks best.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization name *</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                className="input"
                value={type}
                onChange={e => setType(e.target.value as OrgType)}
              >
                {ORG_TYPES.map(t => (
                  <option key={t} value={t}>{ORG_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">States</label>
              <div className="flex gap-4">
                {[['CO', 'Colorado'], ['NM', 'New Mexico']].map(([code, label]) => (
                  <label key={code} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={states.has(code)}
                      onChange={() => toggleState(code)}
                      className="w-4 h-4 accent-brand-blue"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                className="input"
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://www.example.org"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Short description</label>
              <textarea
                className="input min-h-[80px] resize-y"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A one-line summary shown on the directory card…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">About us</label>
              <textarea
                className="input min-h-[120px] resize-y"
                value={aboutUs}
                onChange={e => setAboutUs(e.target.value)}
                placeholder="Describe your organization's strengths, expertise, and what you bring to the 2-3-2 partnership…"
              />
            </div>

            {/* Only platform_admin can toggle live status */}
            {role === 'platform_admin' && (
              <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                <input
                  id="is_live"
                  type="checkbox"
                  checked={isLive}
                  onChange={e => setIsLive(e.target.checked)}
                  className="w-4 h-4 accent-brand-blue"
                />
                <label htmlFor="is_live" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Show in directory
                </label>
              </div>
            )}
          </div>

          {/* ── Areas of expertise ── */}
          <div className="card p-5 space-y-4">
            <h2 className="section-heading">Organization&apos;s areas of expertise</h2>
            <p className="text-sm text-gray-500 -mt-2">Select all that apply to your organization&apos;s work.</p>

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
          </div>

          {/* ── Geographic focus ── */}
          <div className="card p-5 space-y-4">
            <h2 className="section-heading">Where does your organization work?</h2>
            <p className="text-sm text-gray-500 -mt-2">
              Select all the landscapes and watersheds where your organization does restoration work.
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
          </div>

          {error && <p className="text-brand-red text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || saved}
              className="btn-primary flex-1 py-3 text-base"
            >
              {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary px-6 py-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
