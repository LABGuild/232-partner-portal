'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import { buildClassifiedSentence } from '@/lib/types'
import type { HaveNeedType, LandOwnership, PlatformRole } from '@/lib/types'

type Row = {
  id: string
  have_type: HaveNeedType
  need_type: HaveNeedType
  land_ownership: LandOwnership
  watershed_ids: string[]
  project_type_writein: string | null
  details: string | null
  created_at: string
  moderation_status: string
  person: { first_name: string; last_name: string; organizations: { name: string } | { name: string }[] | null } | { first_name: string; last_name: string; organizations: { name: string } | { name: string }[] | null }[] | null
  project_type: { name: string } | { name: string }[] | null
}

export default function ModerationQueuePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<PlatformRole>('user')
  const [pending, setPending] = useState<Row[]>([])
  const [stale, setStale] = useState<Row[]>([])
  const [watershedName, setWatershedName] = useState<Record<string, string>>({})
  const [working, setWorking] = useState<string | null>(null)

  const select = `
    *,
    person:people ( first_name, last_name, organizations ( name ) ),
    project_type:project_types ( name )
  `

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: me } = await supabase
      .from('people').select('platform_role').eq('id', user.id).single()
    const myRole: PlatformRole = me?.platform_role ?? 'user'
    setRole(myRole)

    if (myRole !== 'moderator' && myRole !== 'platform_admin') {
      router.push('/directory')
      return
    }

    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

    const [pendingRes, staleRes, wsRes] = await Promise.all([
      supabase.from('classifieds').select(select).eq('moderation_status', 'pending').order('created_at', { ascending: true }),
      supabase.from('classifieds').select(select).eq('moderation_status', 'approved').lt('created_at', oneYearAgo).order('created_at', { ascending: true }),
      supabase.from('watersheds').select('id, name').order('sort_order'),
    ])

    const map: Record<string, string> = {}
    ;(wsRes.data ?? []).forEach((w: { id: string; name: string }) => { map[w.id] = w.name })
    setWatershedName(map)
    setPending((pendingRes.data ?? []) as Row[])
    setStale((staleRes.data ?? []) as Row[])
    setLoading(false)
  }, [router, select])

  useEffect(() => { loadData() }, [loadData])

  const setStatus = async (id: string, status: 'approved' | 'archived') => {
    setWorking(id)
    const supabase = createClient()
    const { error } = await supabase.from('classifieds').update({ moderation_status: status }).eq('id', id)
    if (error) { alert(error.message); setWorking(null); return }

    // Approving a post runs the matching algorithm (non-blocking)
    if (status === 'approved') {
      try {
        await fetch('/api/classifieds/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classifiedId: id }),
        })
      } catch {
        // Matching can be re-run later; don't block the approval UI.
      }
    }

    setPending(prev => prev.filter(r => r.id !== id))
    setStale(prev => prev.filter(r => r.id !== id))
    setWorking(null)
  }

  const renderSentence = (r: Row) => {
    const person = Array.isArray(r.person) ? r.person[0] : r.person
    const name = person ? `${person.first_name} ${person.last_name}` : 'A partner'
    const pt = Array.isArray(r.project_type) ? r.project_type[0] : r.project_type
    const projName = pt?.name ?? r.project_type_writein ?? ''
    const wsNames = (r.watershed_ids ?? []).map(id => watershedName[id]).filter(Boolean)
    return buildClassifiedSentence({
      name,
      watershedNames: wsNames,
      haveType: r.have_type,
      projectTypeName: projName,
      landOwnership: r.land_ownership,
      needType: r.need_type,
    })
  }

  const orgNameOf = (r: Row) => {
    const person = Array.isArray(r.person) ? r.person[0] : r.person
    const org = Array.isArray(person?.organizations) ? person?.organizations[0] : person?.organizations
    return org?.name ?? ''
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 font-heading">Loading…</div>
      </div>
    )
  }

  const Card = ({ r, stale }: { r: Row; stale?: boolean }) => (
    <div className="card p-5">
      <p className="text-gray-800 leading-relaxed">{renderSentence(r)}</p>
      <p className="text-xs text-gray-400 mt-2">
        {(() => { const p = Array.isArray(r.person) ? r.person[0] : r.person; return p ? `${p.first_name} ${p.last_name}` : 'A partner' })()}
        {orgNameOf(r) ? ` · ${orgNameOf(r)}` : ''}
        {' · '}
        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
      {r.details && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{r.details}</p>}
      <div className="flex items-center gap-2 mt-4">
        <Link href={`/classifieds/${r.id}`} className="text-brand-blue text-xs hover:underline mr-auto">View full post</Link>
        {!stale && (
          <button
            onClick={() => setStatus(r.id, 'approved')}
            disabled={working === r.id}
            className="text-sm font-heading font-semibold text-white bg-brand-green px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {working === r.id ? '…' : 'Approve'}
          </button>
        )}
        <button
          onClick={() => setStatus(r.id, 'archived')}
          disabled={working === r.id}
          className="text-sm font-heading font-semibold text-gray-600 border-2 border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
        >
          Archive
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <Nav role={role} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-heading font-bold text-2xl text-brand-blue mb-1">Classifieds review queue</h1>
        <p className="text-gray-500 text-sm mb-6">Approve posts to make them live, or archive them.</p>

        <h2 className="section-heading">Pending review ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 mb-8">Nothing waiting for review. 🎉</div>
        ) : (
          <div className="space-y-3 mb-8">
            {pending.map(r => <Card key={r.id} r={r} />)}
          </div>
        )}

        {stale.length > 0 && (
          <>
            <h2 className="section-heading">Live over a year — review to archive ({stale.length})</h2>
            <p className="text-sm text-gray-500 -mt-2 mb-3">
              These posts have been live for more than a year. Consider archiving them if they&apos;re no longer relevant.
            </p>
            <div className="space-y-3">
              {stale.map(r => <Card key={r.id} r={r} stale />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
