'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import {
  HAVE_NEED_TYPES,
  LAND_OWNERSHIP_OPTIONS,
  buildClassifiedSentence,
} from '@/lib/types'
import type {
  Watershed,
  ProjectType,
  HaveNeedType,
  LandOwnership,
  ContactPreference,
  PlatformRole,
} from '@/lib/types'

const WRITEIN = '__writein__'

export default function ClassifiedForm({ classifiedId }: { classifiedId?: string }) {
  const router = useRouter()
  const isEdit = !!classifiedId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<PlatformRole>('user')
  const [fullName, setFullName] = useState('')
  const [isContractor, setIsContractor] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const [watersheds, setWatersheds] = useState<Watershed[]>([])
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([])

  // Form state
  const [selectedWatersheds, setSelectedWatersheds] = useState<Set<string>>(new Set())
  const [haveType, setHaveType] = useState<HaveNeedType | ''>('')
  const [needType, setNeedType] = useState<HaveNeedType | ''>('')
  const [projectTypeId, setProjectTypeId] = useState<string>('')
  const [projectTypeWritein, setProjectTypeWritein] = useState('')
  const [landOwnership, setLandOwnership] = useState<LandOwnership | ''>('')
  const [details, setDetails] = useState('')
  const [contactPreference, setContactPreference] = useState<ContactPreference>('email')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [personRes, watershedsRes, typesRes] = await Promise.all([
      supabase
        .from('people')
        .select('first_name, last_name, platform_role, organizations(is_contractor)')
        .eq('id', user.id)
        .single(),
      supabase.from('watersheds').select('*').order('sort_order'),
      supabase.from('project_types').select('*').order('sort_order'),
    ])

    if (personRes.data) {
      const p = personRes.data as {
        first_name: string
        last_name: string
        platform_role: PlatformRole
        organizations: { is_contractor: boolean } | { is_contractor: boolean }[] | null
      }
      setFullName(`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim())
      setRole(p.platform_role ?? 'user')
      const org = Array.isArray(p.organizations) ? p.organizations[0] : p.organizations
      setIsContractor(org?.is_contractor ?? false)
    }

    setWatersheds(watershedsRes.data ?? [])
    setProjectTypes(typesRes.data ?? [])

    // Edit mode: load existing classified and prefill
    if (classifiedId) {
      const { data: c } = await supabase
        .from('classifieds')
        .select('*')
        .eq('id', classifiedId)
        .single()

      if (!c) { router.push('/classifieds'); return }
      if (c.person_id !== user.id) { setBlocked(true); setLoading(false); return }

      setSelectedWatersheds(new Set(c.watershed_ids ?? []))
      setHaveType(c.have_type ?? '')
      setNeedType(c.need_type ?? '')
      if (c.project_type_id) {
        setProjectTypeId(c.project_type_id)
      } else if (c.project_type_writein) {
        setProjectTypeId(WRITEIN)
        setProjectTypeWritein(c.project_type_writein)
      }
      setLandOwnership(c.land_ownership ?? '')
      setDetails(c.details ?? '')
      setContactPreference(c.contact_preference ?? 'email')
    }

    setLoading(false)
  }, [router, classifiedId])

  useEffect(() => { loadData() }, [loadData])

  const toggleWatershed = (id: string) => {
    setSelectedWatersheds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedWatershedNames = watersheds
    .filter(w => selectedWatersheds.has(w.id))
    .map(w => w.name)

  const projectTypeName =
    projectTypeId === WRITEIN
      ? projectTypeWritein
      : projectTypes.find(t => t.id === projectTypeId)?.name ?? ''

  const sentence = buildClassifiedSentence({
    name: fullName,
    watershedNames: selectedWatershedNames,
    haveType: haveType || null,
    projectTypeName,
    landOwnership: landOwnership || null,
    needType: needType || null,
  })

  const sameHaveNeed = haveType !== '' && haveType === needType

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (selectedWatersheds.size === 0) { setError('Please select at least one watershed.'); return }
    if (!haveType) { setError('Please choose what you have.'); return }
    if (!needType) { setError('Please choose what you need.'); return }
    if (sameHaveNeed) { setError('What you have and what you need must be different.'); return }
    if (!projectTypeId) { setError('Please choose a project type.'); return }
    if (projectTypeId === WRITEIN && !projectTypeWritein.trim()) {
      setError('Please write in your project type.'); return
    }
    if (!landOwnership) { setError('Please choose a land ownership type.'); return }
    if (!userId) return

    setSaving(true)
    const supabase = createClient()
    const usingWritein = projectTypeId === WRITEIN

    const payload = {
      have_type: haveType,
      need_type: needType,
      project_type_id: usingWritein ? null : projectTypeId,
      project_type_writein: usingWritein ? projectTypeWritein.trim() : null,
      land_ownership: landOwnership,
      watershed_ids: Array.from(selectedWatersheds),
      details: details.trim() || null,
      contact_preference: contactPreference,
    }

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('classifieds')
        .update(payload)
        .eq('id', classifiedId!)
      if (updateError) { setError(updateError.message); setSaving(false); return }
      router.push(`/classifieds/${classifiedId}`)
      return
    }

    const { data: inserted, error: insertError } = await supabase
      .from('classifieds')
      .insert({ person_id: userId, ...payload })
      .select('id')
      .single()

    if (insertError) { setError(insertError.message); setSaving(false); return }

    if (usingWritein) {
      await supabase.from('project_type_writeins').insert({
        person_id: userId,
        text: projectTypeWritein.trim(),
      })
    }

    try {
      await fetch('/api/classifieds/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classifiedId: inserted?.id }),
      })
    } catch {
      // Non-blocking
    }

    router.push('/classifieds?submitted=1')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 font-heading">Loading…</div>
      </div>
    )
  }

  if (blocked) {
    return (
      <div className="min-h-screen">
        <Nav role={role} />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="card p-8 text-center">
            <h1 className="font-heading font-bold text-xl text-brand-blue mb-2">
              You can only edit your own Classifieds
            </h1>
            <a href="/classifieds" className="btn-primary inline-block mt-4">Back to Classifieds</a>
          </div>
        </div>
      </div>
    )
  }

  if (isContractor && !isEdit) {
    return (
      <div className="min-h-screen">
        <Nav role={role} />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="card p-8 text-center">
            <h1 className="font-heading font-bold text-xl text-brand-blue mb-2">
              Classifieds aren&apos;t available for contractor accounts
            </h1>
            <p className="text-gray-600">
              Because of procurement regulations, contractor organizations have read-only
              directory profiles and can&apos;t post or match on Classifieds. You can still
              browse the directory to connect with partners.
            </p>
            <a href="/directory" className="btn-primary inline-block mt-5">Back to directory</a>
          </div>
        </div>
      </div>
    )
  }

  const typesByCategory = projectTypes.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {} as Record<string, ProjectType[]>)

  const watershedsByGroup: Record<string, Watershed[]> = {
    'Colorado Watersheds': watersheds.filter(w => w.state === 'CO'),
    'New Mexico Watersheds': watersheds.filter(w => w.state === 'NM'),
    'The entire 2-3-2 landscape': watersheds.filter(w => !w.state),
  }

  return (
    <div className="min-h-screen">
      <Nav role={role} />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-heading font-bold text-2xl text-brand-blue">
            {isEdit ? 'Edit your Classified' : 'Post a Classified'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isEdit
              ? 'Update the details below. Changes are saved immediately.'
              : 'Tell other partners what you have and what you’re looking for. Your post is reviewed by Guild staff before it goes live.'}
          </p>
        </div>

        {/* Live sentence preview */}
        <div className="card p-5 mb-6 bg-brand-blue/5 border-brand-blue/20">
          <p className="text-xs font-semibold text-brand-blue uppercase tracking-wider mb-2">Preview</p>
          <p className="text-gray-800 leading-relaxed">{sentence}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Watersheds */}
          <div className="card p-5 space-y-4">
            <h2 className="section-heading">Where do you work? *</h2>
            <p className="text-sm text-gray-500 -mt-2">Select all watersheds this Classified relates to.</p>
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

          {/* Have */}
          <div className="card p-5 space-y-3">
            <h2 className="section-heading">I currently have… *</h2>
            <div className="flex flex-wrap gap-2">
              {HAVE_NEED_TYPES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setHaveType(opt.value)}
                  className={`tag cursor-pointer capitalize transition-colors ${
                    haveType === opt.value
                      ? 'bg-brand-blue text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Project type */}
          <div className="card p-5 space-y-3">
            <h2 className="section-heading">For this kind of project *</h2>
            <select
              className="input"
              value={projectTypeId}
              onChange={e => setProjectTypeId(e.target.value)}
            >
              <option value="">Select a project type…</option>
              {Object.entries(typesByCategory).map(([category, types]) => (
                <optgroup key={category} label={category}>
                  {types.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
              <option value={WRITEIN}>Other — write in…</option>
            </select>
            {projectTypeId === WRITEIN && (
              <input
                className="input"
                value={projectTypeWritein}
                onChange={e => setProjectTypeWritein(e.target.value)}
                placeholder="Describe the project type"
              />
            )}
          </div>

          {/* Land ownership */}
          <div className="card p-5 space-y-3">
            <h2 className="section-heading">On this kind of land *</h2>
            <div className="flex flex-wrap gap-2">
              {LAND_OWNERSHIP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLandOwnership(opt.value)}
                  className={`tag cursor-pointer transition-colors ${
                    landOwnership === opt.value
                      ? 'bg-brand-green text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Need */}
          <div className="card p-5 space-y-3">
            <h2 className="section-heading">I&apos;m looking for a partner who can provide… *</h2>
            <div className="flex flex-wrap gap-2">
              {HAVE_NEED_TYPES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNeedType(opt.value)}
                  className={`tag cursor-pointer capitalize transition-colors ${
                    needType === opt.value
                      ? 'bg-brand-blue text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {sameHaveNeed && (
              <p className="text-brand-red text-sm">
                What you need must be different from what you have.
              </p>
            )}
          </div>

          {/* More details */}
          <div className="card p-5 space-y-3">
            <h2 className="section-heading">More details (optional)</h2>
            <textarea
              className="input min-h-[120px] resize-y"
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Anything else that would help a partner understand the opportunity. (Shown on the full post, not the browse card.)"
            />
          </div>

          {/* Contact preference */}
          <div className="card p-5 space-y-3">
            <h2 className="section-heading">How should matches reach you?</h2>
            <p className="text-sm text-gray-500 -mt-2">
              Your contact info is only shown to confirmed matches — never publicly.
            </p>
            <div className="flex gap-4">
              {(['email', 'phone'] as ContactPreference[]).map(pref => (
                <label key={pref} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="contact"
                    checked={contactPreference === pref}
                    onChange={() => setContactPreference(pref)}
                    className="w-4 h-4 accent-brand-blue"
                  />
                  <span className="text-sm text-gray-700 capitalize">{pref}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-brand-red text-sm">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-3 text-base">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Submit for review'}
            </button>
            <button
              type="button"
              onClick={() => router.push(isEdit ? `/classifieds/${classifiedId}` : '/classifieds')}
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
