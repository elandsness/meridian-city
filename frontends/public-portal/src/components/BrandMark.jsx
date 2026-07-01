/**
 * The Meridian City logo mark — a city skyline under a rising sun. Self-contained
 * (its own orange disc), so it drops in without a background badge. Mirrors
 * frontends/meridian-logo.svg (also used for the favicon).
 */
import { useConfig } from '../config/ConfigContext'

export default function BrandMark({ className = 'w-8 h-8' }) {
  const cfg = useConfig()
  // A non-empty theme.logo overrides the built-in mark with an image; empty = use
  // the inline brand mark below (the Meridian City default).
  if (cfg.theme?.logo) {
    return <img src={cfg.theme.logo} alt={`${cfg.company.name} logo`} className={className} />
  }
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Meridian City logo">
      <circle cx="100" cy="100" r="96" fill="#F97316" />
      <circle cx="100" cy="100" r="96" fill="none" stroke="#FB923C" strokeWidth="3" />
      <path d="M 48 138 A 52 52 0 0 1 152 138 Z" fill="#1E3A5F" />
      <path d="M 44 138 A 56 56 0 0 1 156 138" fill="none" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" />
      <line x1="156" y1="117" x2="172" y2="110" stroke="#1E3A5F" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="142" y1="96" x2="158" y2="80" stroke="#1E3A5F" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="121" y1="82" x2="128" y2="61" stroke="#1E3A5F" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="100" y1="78" x2="100" y2="56" stroke="#1E3A5F" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="79" y1="82" x2="72" y2="61" stroke="#1E3A5F" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="58" y1="96" x2="42" y2="80" stroke="#1E3A5F" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="44" y1="117" x2="28" y2="110" stroke="#1E3A5F" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="40" y="112" width="30" height="26" rx="2" fill="#FFFFFF" />
      <rect x="46" y="118" width="6" height="5" rx="1" fill="#F97316" />
      <rect x="57" y="118" width="6" height="5" rx="1" fill="#F97316" />
      <rect x="85" y="88" width="30" height="50" rx="2" fill="#FFFFFF" />
      <rect x="99" y="78" width="2" height="12" rx="1" fill="#FFFFFF" />
      <circle cx="100" cy="76" r="4" fill="#F97316" />
      <rect x="91" y="95" width="6" height="5" rx="1" fill="#F97316" />
      <rect x="103" y="95" width="6" height="5" rx="1" fill="#F97316" />
      <rect x="91" y="107" width="6" height="5" rx="1" fill="#F97316" />
      <rect x="103" y="107" width="6" height="5" rx="1" fill="#F97316" />
      <rect x="130" y="112" width="30" height="26" rx="2" fill="#FFFFFF" />
      <rect x="136" y="118" width="6" height="5" rx="1" fill="#F97316" />
      <rect x="147" y="118" width="6" height="5" rx="1" fill="#F97316" />
      <rect x="28" y="138" width="144" height="4" rx="2" fill="#FFFFFF" opacity="0.4" />
    </svg>
  )
}
