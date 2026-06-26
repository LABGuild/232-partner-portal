'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/Nav'
import type { PlatformRole } from '@/lib/types'

type OrgRow = {
  id: string
  name: string
  type: string
  is_live: boolean
  is_contractor: boolean
}

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  email: string
  platform_role: PlatformRole
  is_live: boolean
  organizations: { name: string } | null
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [people, setPeople] = useState<PersonRow[]>([])
  const [activeTab, setActiveTab] = useState<'orgs' | 'people'>('orgs')
  const [saving, setSaving] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: me } = await supabase
      .from('people').select('platform_role').eq('id', user.id).single()

    if (me?.platform_role !== 'platform_admin') {
      router.push('/directory')
      return
    }

    const [orgsRes, peopleRes] = await Promise.all([
      supabase
        .from('organizations')
        .select('id, name, type, is_live, is_contractor')
        .order('name'),
      supabase
        .from('people')
        .select('id, first_name, last_name, email, platform_role, is_live, organizations(name)')
        .order('last_name'),
    ])

    setOrgs(orgsRes.data ?? [])
    setPeople(peopleRes.data ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  const toggleOrgLive = async (orgId: string, current: boolean) => {
    setSaving(orgId)
    const supabase = createClient()
    await supabase.from('organizations').update({ is_live: !current }).eq('id', orgId)
    setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, is_live: !current } : o))
    setSaving(null)
  }

  const updatePersonRole = async (personId: string, newRole: PlatformRole) => {
    setSaving(personId)
    const supabase = createClient()
    await supabase.from('people').update({ platform_role: newRole }).eq('id', personId)
    setPeople(prev => prev.map(p => p.id === personId ? { ...p, platform_role: newRole } : p))
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 font-heading">Loading…</div>
      </div>
    )
  }

  const liveOrgs = orgs.filter(o => o.is_live).length
  const livePeople = people.filter(p => p.is_live).length

  return (
    <div className="min-h-screen">
      <Nav role="platform_admin" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-heading font-bold text-2xl text-brand-blue mb-6">Admin</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total orgs', value: orgs.length },
            { label: 'Live orgs', value: liveOrgs },
            { label: 'Total people', value: people.length },
            { label: 'Live profiles', value: livePeople },
          ].map(stat => (
            <div key={stat.label} className="card p-4 text-center">
              <div className="font-heading font-bold text-3xl text-brand-blue">{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['orgs', 'people'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-heading text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-brand-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'orgs' ? `Organizations (${orgs.length})` : `People (${people.length})`}
            </button>
          ))}
        </div>

        {/* ── Organizations tab ── */}
        {activeTab === 'orgs' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Organization</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Type</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Live</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orgs.map(org => (
                  <tr key={org.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {org.name}
                      {org.is_contractor && (
                        <span className="ml-2 text-xs text-gray-400">(contractor)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{org.type}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleOrgLive(org.id, org.is_live)}
                        disabled={saving === org.id}
                        aria-label={org.is_live ? 'Make private' : 'Make live'}
                        className={`w-10 h-6 rounded-full transition-colors relative inline-block ${
                          org.is_live ? 'bg-brand-green' : 'bg-gray-200'
                        } ${saving === org.id ? 'opacity-50' : ''}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          org.is_live ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/org/${org.id}/edit`}
                        className="text-brand-blue text-xs hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── People tab ── */}
        {activeTab === 'people' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Org</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {people.map(person => (
                  <tr key={person.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {person.first_name} {person.last_name}
                      {!person.is_live && (
                        <span className="ml-1.5 text-xs text-gray-400">(hidden)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{person.email}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                      {(person.organizations as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={person.platform_role}
                        disabled={saving === person.id}
                        onChange={e => updatePersonRole(person.id, e.target.value as PlatformRole)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                      >
                        <option value="user">Member</option>
                        <option value="org_admin">Org Admin</option>
                        <option value="moderator">Moderator</option>
                        <option value="platform_admin">Platform Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
