import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PageComposer from '../PageComposer'
import { COMPONENT_REGISTRY } from '../../config/componentRegistry'

// WeatherWidget calls useConfig() — mock it so PageComposer can render modules
// without needing the full ConfigProvider in the test DOM.
vi.mock('../../config/ConfigContext', () => ({
  useConfig: () => ({
    company: { name: 'Test Company' },
    terminology: {},
    theme: { colors: {} },
  }),
}))

// Provide a minimal mock for any entity-component imports that the registry
// pulls in but we do not need to test here.
vi.mock('../../components/entity/EntityListPage', () => ({
  default: () => <div data-testid="entity-list">Entity List</div>,
}))
vi.mock('../../components/entity/EntityDetailPage', () => ({
  default: () => <div data-testid="entity-detail">Entity Detail</div>,
}))
vi.mock('../../components/entity/EntityMapPage', () => ({
  default: () => <div data-testid="entity-map">Entity Map</div>,
}))
vi.mock('../../components/entity/EntityAnalyticsPage', () => ({
  default: () => <div data-testid="entity-analytics">Entity Analytics</div>,
}))
vi.mock('../../components/entity/EntityJourneyPage', () => ({
  default: () => <div data-testid="entity-journey">Entity Journey</div>,
}))
vi.mock('../../components/entity/StatusMapPage', () => ({
  default: () => <div data-testid="status-map">Status Map</div>,
}))
vi.mock('../../components/ChatWidget', () => ({
  default: () => <div data-testid="chat-widget">Chat Widget</div>,
}))
vi.mock('../../components/TransitPanel', () => ({
  default: () => <div data-testid="transit-panel">Transit Panel</div>,
}))

describe('PageComposer', () => {
  it('renders modules from a valid page in the config', () => {
    const config = {
      pages: {
        home: {
          modules: [
            { type: 'weather', location: 'Test City' },
            { type: 'news-ticker', headlines: ['Test headline'] },
          ],
        },
      },
    }

    render(<PageComposer pageId="home" config={config} />)

    expect(screen.getByText('Test City')).toBeInTheDocument()
    expect(screen.getByText('Test headline')).toBeInTheDocument()
  })

  it('renders a weather module with the configured location', () => {
    const config = {
      pages: {
        home: {
          modules: [{ type: 'weather', location: 'Portland' }],
        },
      },
    }

    render(<PageComposer pageId="home" config={config} />)
    expect(screen.getByText('Portland')).toBeInTheDocument()
  })

  it('renders a news-ticker module with configured headlines', () => {
    const config = {
      pages: {
        home: {
          modules: [{ type: 'news-ticker', headlines: ['Alpha', 'Beta'] }],
        },
      },
    }

    render(<PageComposer pageId="home" config={config} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('renders entity-list when the registry has it', () => {
    const config = {
      pages: {
        home: {
          modules: [{ type: 'entity-list', entityType: 'incident' }],
        },
      },
    }

    render(<PageComposer pageId="home" config={config} />)
    expect(screen.getByTestId('entity-list')).toBeInTheDocument()
  })

  it('renders chat-widget when the registry has it', () => {
    const config = {
      pages: {
        home: {
          modules: [{ type: 'chat-widget' }],
        },
      },
    }

    render(<PageComposer pageId="home" config={config} />)
    expect(screen.getByTestId('chat-widget')).toBeInTheDocument()
  })

  it('renders transit-panel when the registry has it', () => {
    const config = {
      pages: {
        home: {
          modules: [{ type: 'transit-map' }],
        },
      },
    }

    render(<PageComposer pageId="home" config={config} />)
    expect(screen.getByTestId('transit-panel')).toBeInTheDocument()
  })

  it('shows an error message when the page is not found in config', () => {
    const config = { pages: {} }

    render(<PageComposer pageId="nonexistent" config={config} />)
    expect(screen.getByText(/Page "nonexistent" not found/)).toBeInTheDocument()
  })

  it('shows a "no modules" message when the page has no modules array', () => {
    const config = { pages: { home: {} } }

    render(<PageComposer pageId="home" config={config} />)
    expect(screen.getByText(/No modules configured/)).toBeInTheDocument()
  })

  it('shows a warning for unknown component types', () => {
    const config = {
      pages: {
        home: {
          modules: [{ type: 'alien-widget' }],
        },
      },
    }

    render(<PageComposer pageId="home" config={config} />)
    expect(screen.getByText(/Unknown component type/)).toBeInTheDocument()
    expect(screen.getByText('alien-widget')).toBeInTheDocument()
  })

  it('passes module props (minus type and position) to the component', () => {
    // WeatherWidget reads `location` from props; verify it reaches the component.
    const config = {
      pages: {
        home: {
          modules: [{ type: 'weather', location: 'Austin', units: 'celsius' }],
        },
      },
    }

    render(<PageComposer pageId="home" config={config} />)
    expect(screen.getByText('Austin')).toBeInTheDocument()
    // celsius mode shows 24, fahrenheit would show 75
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('renders full-width modules in a col-span-2 container', () => {
    const config = {
      pages: {
        home: {
          modules: [{ type: 'news-ticker', position: 'full', headlines: ['Wide'] }],
        },
      },
    }

    const { container } = render(<PageComposer pageId="home" config={config} />)
    // The wrapper div for a full-width module should have col-span-2
    const wrappers = container.querySelectorAll('[class*="col-span-2"]')
    expect(wrappers.length).toBeGreaterThan(0)
  })

  it('renders modules in a two-column grid on md+ screens', () => {
    const config = {
      pages: {
        home: {
          modules: [
            { type: 'weather', location: 'A' },
            { type: 'news-ticker', headlines: ['B'] },
          ],
        },
      },
    }

    const { container } = render(<PageComposer pageId="home" config={config} />)
    expect(container.firstChild).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2')
  })

  it('handles an empty modules array gracefully', () => {
    const config = {
      pages: {
        home: { modules: [] },
      },
    }

    render(<PageComposer pageId="home" config={config} />)
    expect(screen.getByText(/No modules configured/)).toBeInTheDocument()
  })

  it('handles a config with no pages key', () => {
    render(<PageComposer pageId="home" config={{}} />)
    expect(screen.getByText(/Page "home" not found/)).toBeInTheDocument()
  })
})
