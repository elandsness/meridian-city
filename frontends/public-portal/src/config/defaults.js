// Default industry config — reproduces "Meridian City" exactly. Baked-in fallback
// used when /config.json is absent (local `vite` dev) or fails to load. In a
// deployed instance, nginx serves /config.json (rendered by Helm from the
// `industry` values block) and it is merged over these defaults at startup.
//
// Keep in sync with helm/values.yaml `industry:` and docs/industry-config.schema.json
// until a generator unifies them. Colors are authored as hex; the loader converts
// them to the RGB channels the CSS variables expect (see ConfigContext.jsx).
export const DEFAULT_CONFIG = {
  version: 1,
  id: 'city',
  company: {
    name: 'Meridian City',
    short: 'Meridian',
    tagline: 'Your city, connected.',
    assistant: { name: 'Meri', persona: "Meridian City's virtual assistant" },
  },
  theme: {
    colors: {
      brand: '#0C447C',
      brandDeep: '#082f57',
      brandSoft: '#185FA5',
      brandTint: '#E6F1FB',
      accent: '#EF9F27',
      accentSoft: '#f6b54e',
      accentInk: '#412402',
    },
    logo: '', // empty = use the built-in inline BrandMark; set a path/URL to override
    favicon: '/meridian-logo.svg',
  },
  terminology: {
    customer: 'Citizen',
    customerPlural: 'Citizens',
    request: 'Service request',
    requestPlural: 'Service requests',
    incident: 'Incident',
    incidentPlural: 'Incidents',
    workOrder: 'Work order',
    asset: 'Asset',
    assetPlural: 'Assets',
  },
  screens: {
    public: ['home', 'service-requests', 'store', 'billing', 'messages'],
    ops: ['overview', 'iot', 'incidents', 'requests', 'analytics', 'demo-control'],
    disabled: [],
  },
}

export default DEFAULT_CONFIG
