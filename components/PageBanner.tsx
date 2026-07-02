import type { ReactNode } from 'react'

export default function PageBanner({
  image,
  title,
  subtitle,
  action,
}: {
  image: string
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl mb-6 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-blue/85 to-brand-blue/60" />
      <div className="relative px-6 py-8 sm:py-10 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white drop-shadow-sm">
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/85 text-sm mt-1.5 max-w-xl">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}
