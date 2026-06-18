/**
 * Branded SVG product illustrations for the city store, keyed by the product's
 * image_key (mug / tee / sticker / dog). Falls back to a generic gift icon for an
 * unknown key. New orange/navy Meridian palette.
 */
function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="#1E3A5F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Product">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v9h14v-9M12 8S11 3 8.5 3 6 6 6 6s2 2 6 2zM12 8s1-5 3.5-5S18 6 18 6s-2 2-6 2z" />
    </svg>
  )
}

export default function ProductImage({ imageKey }) {
  switch (imageKey) {
    case 'mug':
      return (
        <svg viewBox="138 54 112 96" className="h-16 w-auto" role="img" aria-label="Meridian mug">
          <path d="M171 70c-6 -6 4 -10 -2 -16M201 70c-6 -6 4 -10 -2 -16" fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
          <path d="M219 96c20 -2 20 30 0 30" fill="none" stroke="#1E3A5F" strokeWidth="8" strokeLinecap="round" />
          <rect x="147" y="82" width="72" height="62" rx="10" fill="#1E3A5F" />
          <circle cx="183" cy="113" r="10" fill="none" stroke="#F97316" strokeWidth="2.5" />
          <path d="M183 100v-3M183 126v3M170 113h-3M196 113h3" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )
    case 'tee':
      return (
        <svg viewBox="430 64 130 94" className="h-16 w-auto" role="img" aria-label="City t-shirt">
          <path d="M475 72 L451 84 L437 100 L455 112 L455 150 L535 150 L535 112 L553 100 L539 84 L515 72 C505 84 485 84 475 72 Z" fill="#1E3A5F" />
          <circle cx="495" cy="104" r="7" fill="#F97316" />
          <rect x="471" y="118" width="9" height="16" fill="#F97316" />
          <rect x="484" y="112" width="9" height="22" fill="#FB923C" />
          <rect x="497" y="120" width="9" height="14" fill="#F97316" />
          <rect x="510" y="116" width="9" height="18" fill="#FB923C" />
        </svg>
      )
    case 'sticker':
      return (
        <svg viewBox="86 304 200 72" className="h-14 w-auto" role="img" aria-label="Bumper sticker">
          <rect x="92" y="312" width="186" height="56" rx="12" fill="#FFFFFF" stroke="#1E3A5F" strokeWidth="3" />
          <circle cx="120" cy="340" r="13" fill="#F97316" />
          <rect x="112" y="346" width="16" height="2" rx="1" fill="#1E3A5F" opacity="0.5" />
          <rect x="113" y="340" width="3.4" height="7" rx="1" fill="#FFFFFF" />
          <rect x="118.3" y="335" width="3.4" height="12" rx="1" fill="#FFFFFF" />
          <rect x="123.6" y="340" width="3.4" height="7" rx="1" fill="#FFFFFF" />
          <text x="148" y="346" style={{ fontSize: '16px', fontWeight: 500, fill: '#1E3A5F' }}>MERIDIAN CITY</text>
        </svg>
      )
    case 'dog':
      return (
        <svg viewBox="430 296 145 90" className="h-16 w-auto" role="img" aria-label="Dog sweater">
          <path d="M455 352 q-10 -6 -14 -22" fill="none" stroke="#C2825A" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="495" cy="345" rx="50" ry="24" fill="#C2825A" />
          <circle cx="540" cy="320" r="20" fill="#C2825A" />
          <ellipse cx="560" cy="324" rx="12" ry="8" fill="#C2825A" />
          <path d="M527 304 q-8 -10 -16 -2 q4 8 14 10 Z" fill="#9C6B45" />
          <circle cx="546" cy="316" r="2.4" fill="#1E3A5F" />
          <rect x="468" y="356" width="8" height="20" rx="3" fill="#C2825A" />
          <rect x="512" y="356" width="8" height="20" rx="3" fill="#C2825A" />
          <path d="M465 330 q30 -20 60 0 l-2 30 q-28 12 -56 0 Z" fill="#1E3A5F" />
          <path d="M467 344 q28 -12 56 0" fill="none" stroke="#F97316" strokeWidth="3" />
          <circle cx="495" cy="332" r="6" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
          <path d="M495 327v-2M495 337v2M490 332h-2M500 332h2" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    default:
      return <GiftIcon />
  }
}
