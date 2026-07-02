export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-16">
      {/* Mountain silhouette rising into the teal footer */}
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="block w-full h-12 sm:h-16"
        style={{ marginBottom: -1 }}
        aria-hidden="true"
      >
        <path
          fill="#28657A"
          d="M0,120 L0,72 L150,34 L300,70 L430,28 L560,66 L700,20 L840,64 L980,30 L1120,68 L1270,32 L1440,66 L1440,120 Z"
        />
      </svg>

      <div className="bg-brand-blue text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
              <img src="/logo-mark.png" alt="" className="w-7 h-7 object-contain" />
            </div>
            <span className="font-heading font-semibold tracking-wide">2-3-2 Partnership</span>
          </div>
          <p className="text-center text-white/70 text-sm mt-3 max-w-xl mx-auto">
            (Re)connecting forests, waters &amp; people across the headwaters of the Rio Grande,
            Rio Chama, and San Juan.
          </p>
          <p className="text-center text-white/40 text-xs mt-4">
            Two watersheds · Three rivers · Two states &nbsp;·&nbsp; © {year} 2-3-2 Cohesive Strategy Partnership
          </p>
        </div>
      </div>
    </footer>
  )
}
