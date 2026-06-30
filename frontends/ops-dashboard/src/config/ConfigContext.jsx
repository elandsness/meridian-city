import { createContext, useContext } from 'react'
import DEFAULT_CONFIG from './defaults'

// Industry config available app-wide. Defaults to the baked Meridian City config
// so components render correctly even before loadConfig() resolves.
const ConfigContext = createContext(DEFAULT_CONFIG)
export const ConfigProvider = ConfigContext.Provider
export const useConfig = () => useContext(ConfigContext)

// Terminology helper hook: const t = useT(); t('customer') -> 'Citizen'.
// Returns the key unchanged if the term is not defined.
export function useT() {
  const config = useConfig()
  return (key) => config?.terminology?.[key] ?? key
}

// Map config theme color keys -> CSS custom properties (defaults live in index.css).
const COLOR_VARS = {
  brand: '--brand',
  brandDeep: '--brand-deep',
  brandSoft: '--brand-soft',
  brandTint: '--brand-tint',
  accent: '--accent',
  accentSoft: '--accent-soft',
  accentInk: '--accent-ink',
}

// '#0C447C' | '#abc' -> '12 68 124' (space-separated channels for rgb(var() / a)).
function hexToChannels(hex) {
  if (typeof hex !== 'string') return null
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return null
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return null
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

// Apply brand color CSS variables + favicon from the config. (document.title is
// set by each SPA's entrypoint, since each composes its own title.)
function applyTheme(config) {
  const colors = config?.theme?.colors || {}
  const root = document.documentElement
  for (const [key, cssVar] of Object.entries(COLOR_VARS)) {
    const channels = hexToChannels(colors[key])
    if (channels) root.style.setProperty(cssVar, channels)
  }
  const favicon = config?.theme?.favicon
  if (favicon) {
    let link = document.querySelector('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = favicon
  }
}

// Merge a (possibly partial) fetched config over the baked defaults, one level
// deep for the object sections so a partial config.json can't blank a whole
// section.
function mergeConfig(base, override) {
  if (!override || typeof override !== 'object') return base
  const out = { ...base, ...override }
  for (const key of ['company', 'theme', 'terminology', 'screens']) {
    if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
      out[key] = { ...base[key], ...override[key] }
    }
  }
  if (override.theme?.colors) {
    out.theme = { ...out.theme, colors: { ...base.theme.colors, ...override.theme.colors } }
  }
  return out
}

// Fetch /config.json (served by nginx from the mounted industry ConfigMap), merge
// over defaults, and apply the theme. Falls back to defaults if the file is absent
// (local vite dev) or on any error. Always resolves — never blocks app startup.
export async function loadConfig() {
  let config = DEFAULT_CONFIG
  try {
    const res = await fetch('/config.json', { cache: 'no-store' })
    if (res.ok) {
      config = mergeConfig(DEFAULT_CONFIG, await res.json())
    }
  } catch {
    // network/parse error — keep the baked defaults
  }
  applyTheme(config)
  return config
}
