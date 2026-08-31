import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PageComposer from '../PageComposer'

// Mock useConfig
vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({
    company: { name: 'Test Company' },
    terminology: {},
  }),
}))

describe('PageComposer', () => {
  it('renders a page from config', () => {
    const config = {
      pages: {
        home: {
          modules: [
            { type: 'weather', location: 'Test City' },
          ],
        },
      },
    }

    const { container } = render(
      <PageComposer pageId="home" config={config} />
    )

    expect(container).toBeTruthy()
  })

  it('shows warning for unknown component type', () => {
    const config = {
      pages: {
        home: {
          modules: [
            { type: 'unknown-component' },
          ],
        },
      },
    }

    const { container } = render(
      <PageComposer pageId="home" config={config} />
    )

    expect(container.innerHTML).toContain('Unknown component')
  })

  it('shows empty state for missing page (falls back to config.home)', () => {
    const config = {
      pages: {},
    }

    const { container } = render(
      <PageComposer pageId="nonexistent" config={config} />
    )

    // Falls back to config.home['nonexistent'] which is undefined → empty → no modules message
    expect(container.innerHTML).toContain('No modules configured')
  })

  it('renders a news-ticker module with configured headlines', () => {
    const config = {
      pages: {
        home: {
          modules: [
            { type: 'news-ticker', headlines: ['Alpha', 'Beta', 'Gamma'] },
          ],
        },
      },
    }

    const { container } = render(
      <PageComposer pageId="home" config={config} />
    )

    // NewsTicker only shows the first headline (may be shuffled, so check for any)
    const ticker = container.querySelector('[class*="animate-ticker-in"]')
    expect(ticker).toBeTruthy()
    expect(ticker.textContent).toBeTruthy()
    expect(ticker.textContent.length).toBeGreaterThan(0)
  })

  it('renders multiple modules', () => {
    const config = {
      pages: {
        home: {
          modules: [
            { type: 'weather', location: 'Test City' },
            { type: 'news-ticker', headlines: ['Test Headline'] },
          ],
        },
      },
    }

    const { container } = render(
      <PageComposer pageId="home" config={config} />
    )

    expect(container.querySelectorAll('[class*="grid"]').length).toBeGreaterThan(0)
  })

  it('handles empty modules array', () => {
    const config = {
      pages: {
        home: {
          modules: [],
        },
      },
    }

    const { container } = render(
      <PageComposer pageId="home" config={config} />
    )

    expect(container).toBeTruthy()
    // Note: no grid is rendered when there are no modules
    expect(container.innerHTML).toContain('No modules configured')
  })

  it('passes module props (minus type and position) to the component', () => {
    const config = {
      pages: {
        home: {
          modules: [
            { type: 'weather', location: 'Austin', units: 'celsius' },
          ],
        },
      },
    }

    const { container } = render(
      <PageComposer pageId="home" config={config} />
    )

    // Should show the location
    expect(screen.getByText('Austin')).toBeTruthy()
    // Temperature should be rendered (format depends on units)
    expect(container.innerHTML).toMatch(/24.*/)
  })

  it('supports full-width layout via position full', () => {
    const config = {
      pages: {
        home: {
          modules: [
            { type: 'weather', location: 'Test City', position: 'full' },
          ],
        },
      },
    }

    const { container } = render(
      <PageComposer pageId="home" config={config} />
    )

    // Full-width module should have col-span-2
    expect(container.innerHTML).toContain('col-span-2')
  })

  it('falls back to config.home when config.pages is absent', () => {
    const config = {
      home: {
        public: [
          { id: 'weather', location: 'Test City' },
        ],
      },
    }

    const { container } = render(
      <PageComposer pageId="public" config={config} />
    )

    expect(container).toBeTruthy()
    expect(screen.getByText('Test City')).toBeTruthy()
  })

  it('prefers config.pages over config.home when both exist', () => {
    const config = {
      pages: {
        home: {
          modules: [
            { type: 'weather', location: 'From Pages' },
          ],
        },
      },
      home: {
        public: [
          { id: 'weather', location: 'From Home' },
        ],
      },
    }

    const { container } = render(
      <PageComposer pageId="home" config={config} />
    )

    // Should use config.pages (first match wins)
    expect(container.innerHTML).toContain('From Pages')
    expect(container.innerHTML).not.toContain('From Home')
  })

  it('supports id key for component lookup (legacy format)', () => {
    const config = {
      home: {
        public: [
          { id: 'weather', location: 'Test City' },
        ],
      },
    }

    const { container } = render(
      <PageComposer pageId="public" config={config} />
    )

    expect(container).toBeTruthy()
    expect(screen.getByText('Test City')).toBeTruthy()
  })

  it('falls back to empty when neither config path has modules', () => {
    const config = {}

    const { container } = render(
      <PageComposer pageId="home" config={config} />
    )

    expect(container.innerHTML).toContain('No modules configured')
  })
})
