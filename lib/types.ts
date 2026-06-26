export type OrgType = 'NGO' | 'Agency' | 'Tribal' | 'Academic' | 'Contractor'
export type PlatformRole = 'platform_admin' | 'moderator' | 'org_admin' | 'user'

// Engagement levels — stored as text[] in the DB so people can select multiple
export const ENGAGEMENT_LEVELS = [
  'Executive Committee Member',
  'Subcommittee Chair',
  'Subcommittee Member',
  'Active Partner',
  'New to the Partnership',
  '2-3-2 OG',
] as const

export type EngagementLevel = typeof ENGAGEMENT_LEVELS[number]

export interface Organization {
  id: string
  name: string
  type: OrgType
  states: string[] | null
  website: string | null
  logo_url: string | null
  description: string | null
  about_us: string | null          // richer "about us" narrative
  is_live: boolean
  is_contractor: boolean
  created_at: string
  updated_at: string
  // joined relations
  expertise_tags?: ExpertiseTag[]
  watersheds?: Watershed[]
}

export interface Person {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  title: string | null
  org_id: string | null
  engagement_level: string[] | null   // text[] in DB — multi-select
  platform_role: PlatformRole
  is_live: boolean
  photo_url: string | null            // profile photo (Supabase Storage)
  about_me: string | null             // optional freeform bio
  linkedin_url: string | null         // optional LinkedIn URL
  show_email: boolean                 // email/phone visible to other partners
  custom_expertise: string | null
  custom_watershed: string | null     // write-in watershed
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

export type ModerationStatus = 'pending' | 'approved' | 'archived'
export type ContactPreference = 'email' | 'phone'

// What a partner can have or need (Classifieds)
export type HaveNeedType = 'funding' | 'capacity' | 'expertise'
export type LandOwnership = 'public' | 'private' | 'tribal'

export interface ProjectType {
  id: string
  name: string
  category: string
  sort_order: number
  is_custom: boolean
}

export interface Classified {
  id: string
  person_id: string
  have_type: HaveNeedType
  need_type: HaveNeedType
  project_type_id: string | null
  project_type_writein: string | null
  land_ownership: LandOwnership
  watershed_ids: string[]
  details: string | null
  contact_preference: ContactPreference
  moderation_status: ModerationStatus
  created_at: string
  updated_at: string
  // joined relations
  person?: Person
  project_type?: ProjectType | null
}

// Have/need option list (used in forms + sentence)
export const HAVE_NEED_TYPES: { value: HaveNeedType; label: string }[] = [
  { value: 'funding',   label: 'funding' },
  { value: 'capacity',  label: 'capacity' },
  { value: 'expertise', label: 'expertise' },
]

// Land ownership option list
export const LAND_OWNERSHIP_OPTIONS: { value: LandOwnership; label: string }[] = [
  { value: 'public',  label: 'public' },
  { value: 'private', label: 'private' },
  { value: 'tribal',  label: 'Tribal' },
]

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  NGO:        'Non-Governmental Organization',
  Agency:     'Federal or State Agency',
  Tribal:     'Tribal Nation or Organization',
  Academic:   'Academic or Research Institution',
  Contractor: 'Contractor or Consulting Firm',
}

// Tag colors per org type (used on cards and profile pages)
export const ORG_TYPE_COLORS: Record<OrgType, string> = {
  NGO:        'bg-brand-blue text-white',
  Agency:     'bg-brand-green text-white',
  Tribal:     'bg-brand-red text-white',
  Academic:   'bg-brand-yellow text-gray-900',
  Contractor: 'bg-gray-400 text-white',
}

const LAND_LABEL: Record<LandOwnership, string> = {
  public: 'public',
  private: 'private',
  tribal: 'Tribal',
}

// Builds the auto-generated Classifieds posting sentence.
// Used identically on the create form preview, browse cards, and detail page.
export function buildClassifiedSentence(args: {
  name?: string | null
  watershedNames: string[]
  haveType?: HaveNeedType | null
  projectTypeName?: string | null
  landOwnership?: LandOwnership | null
  needType?: HaveNeedType | null
}): string {
  const name = args.name?.trim() || 'a 2-3-2 partner'
  const watersheds =
    args.watershedNames.length > 0
      ? joinWithAnd(args.watershedNames)
      : 'the 2-3-2 landscape'
  const have = args.haveType ?? '…'
  const project = args.projectTypeName?.trim() || '…'
  const land = args.landOwnership ? LAND_LABEL[args.landOwnership] : '…'
  const need = args.needType ?? '…'

  return `Hi, my name is ${name}. I work mostly in ${watersheds}. ` +
    `I currently have ${have} for ${project} on ${land} land, ` +
    `and I'm looking for a partner who can provide ${need}.`
}

function joinWithAnd(items: string[]): string {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
