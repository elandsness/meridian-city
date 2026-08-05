import { useConfig } from '../../config/ConfigContext'

export default function WelcomeHero() {
  const cfg = useConfig()
  const name = cfg.company?.name ?? 'Welcome'
  const tagline = cfg.company?.tagline ?? ''

  return (
    <div
      className="rounded-2xl px-8 py-12 text-white text-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--brand) 0%, color-mix(in srgb, var(--brand) 60%, var(--accent, #0ea5e9)) 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="relative z-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight drop-shadow-sm">{name}</h1>
        {tagline && (
          <p className="mt-3 text-lg md:text-xl opacity-90 font-light max-w-xl mx-auto">{tagline}</p>
        )}
      </div>
    </div>
  )
}
