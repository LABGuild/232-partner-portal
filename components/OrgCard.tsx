import Link from 'next/link'
import type { Organization } from '@/lib/types'
import { ORG_TYPE_LABELS, ORG_TYPE_COLORS } from '@/lib/types'

interface OrgCardProps {
  org: Organization
  peopleCount?: number
}

export default function OrgCard({ org, peopleCount }: OrgCardProps) {
  return (
    <Link href={`/org/${org.id}`}>
      <div className="card p-5 h-full flex flex-col gap-3 cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading font-semibold text-gray-900 text-base leading-snug flex-1">
            {org.name}
          </h3>
          {org.logo_url && (
            <img
              src={org.logo_url}
              alt={`${org.name} logo`}
              className="w-10 h-10 object-contain rounded flex-shrink-0"
            />
          )}
        </div>

        {/* Type badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`tag ${ORG_TYPE_COLORS[org.type]}`}>
            {org.type === 'NGO' ? 'NGO' : ORG_TYPE_LABELS[org.type].split(' ')[0]}
          </span>
          {org.states && org.states.length > 0 && (
            <span className="tag bg-gray-100 text-gray-600">
              {org.states.join(' · ')}
            </span>
          )}
          {org.is_contractor && (
            <span className="tag bg-gray-100 text-gray-500 text-xs">
              Contractor
            </span>
          )}
        </div>

        {/* Description */}
        {org.description && (
          <p className="text-gray-600 text-sm line-clamp-2 flex-1">
            {org.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          {org.website ? (
            <span className="text-brand-blue text-xs truncate max-w-[180px]">
              {org.website.replace(/^https?:\/\//, '')}
            </span>
          ) : (
            <span />
          )}
          {peopleCount !== undefined && peopleCount > 0 && (
            <span className="text-gray-400 text-xs">
              {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
