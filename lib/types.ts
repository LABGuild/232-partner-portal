export type OrgType = 'NGO' | 'Agency' | 'Tribal' | 'Academic' | 'Contractor'
export type PlatformRole = 'platform_admin' | 'org_admin' | 'user'
export type EngagementLevel = 'Core partner' | 'Active participant' | 'Subscriber'

export interface Organization {
  id: string
  name: string
  type: OrgType
  states: string[] | null
  website: string | null
  logo_url: string | null
  description: string | null
  is_live: boolean
  is_contractor: boolean
  created_at: string
  updated_at: string
}

export interface Person {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  title: string | null
  org_id: string | null
  engagement_level: EngagementLevel | null
  platform_role: PlatformRole
  is_live: boolean
  custom_expertise: string | null
  created_at: string
  updated_at: string
  // joined relations
  organization?: Organization | null
  expertise_tags?: ExpertiseTag[]
  watersheds?: Watershed[]
}

export interface ExpertiseTag {
  id: string
  name: string
  category: string
  sort_order: number
  is_custom: boolean
}

export interface Watershed {
  id: string
  name: string
  state: string | null
  sort_order: number
}

export type HaveOrNeed = 'have' | 'need'
export type ModerationStatus = 'pending' | 'approved' | 'archived'
export type ContactPreference = 'email' | 'phone'

export interface Classified {
  id: string
  person_id: string
  have_or_need: HaveOrNeed
  category: string
  activity_types: string[]
  land_ownership: string[]
  watersheds: string[]
  custom_location: string | null
  details: string | null
  contact_preference: ContactPreference
  moderation_status: ModerationStatus
  created_at: string
  updated_at: string
  // joined
  person?: Person
}

// Dropdown option lists (used in forms)
export const CLASSIFIED_CATEGORIES = [
  'Funding',
  'Capacity (labor/crew)',
  'Equipment',
  'Technical expertise',
  'Data or monitoring',
  'Permits or regulatory support',
  'Coordination / facilitation',
] as const

export const ACTIVITY_TYPES = [
  'Coordination',
  'Planning',
  'Implementation',
  'Monitoring',
  'Permitting',
  'Transportation',
  'Community engagement',
] as const

export const LAND_OWNERSHIP_TYPES = [
  'State',
  'Private',
  'Tribal',
  'National Forest System (NFS)',
  'Other federal (non-NFS)',
] as const

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  NGO:        'Non-Governmental Organization',
  Agency:     'Federal or State Agency',
  Tribal:     'Tribal Nation or Organization',
  Academic:   'Academic or Research Institution',
  Contractor: 'Contractor or Consulting Firm',
}

export const ORG_TYPE_COLORS: Record<OrgType, string> = {
  NGO:        'bg-brand-blue text-white',
  Agency:     'bg-brand-green text-white',
  Tribal:     'bg-brand-red text-white',
  Academic:   'bg-brand-yellow text-gray-900',
  Contractor: 'bg-gray-400 text-white',
}
