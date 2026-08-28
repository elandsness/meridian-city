import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import WeatherWidget from '../WeatherWidget'

// Mock ConfigContext — WeatherWidget calls useConfig() internally.
vi.mock('../../config/ConfigContext', () => ({
  useConfig: () => ({
    company: { name: 'Test Company' },
    terminology: {},
    theme: { colors: {} },
  }),
}))

describe('WeatherWidget', () => {
  it('renders the fallback location from config when no location prop is given', () => {
    render(<WeatherWidget />)
    expect(screen.getByText('Test Company')).toBeInTheDocument()
  })

  it('renders the custom location prop over the config fallback', () => {
    render(<WeatherWidget location="Custom City" />)
    expect(screen.getByText('Custom City')).toBeInTheDocument()
    expect(screen.queryByText('Test Company')).not.toBeInTheDocument()
  })

  it('falls back to "Meridian City" when config has no company.name and no location prop', () => {
    vi.mocked(useConfig).mockReturnValueOnce({
      company: {},
      terminology: {},
      theme: { colors: {} },
    })
    render(<WeatherWidget />)
    expect(screen.getByText('Meridian City')).toBeInTheDocument()
  })

  it('displays temperature in fahrenheit by default', () => {
    // 24 C -> 75 F (Math.round(24 * 9) / 5 + 32 = 75)
    render(<WeatherWidget />)
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('Sunny')).toBeInTheDocument()
  })

  it('displays temperature in celsius when units="celsius"', () => {
    render(<WeatherWidget units="celsius" />)
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('does not display fahrenheit values when units is celsius', () => {
    render(<WeatherWidget units="celsius" />)
    // 75 is the fahrenheit value; should not appear when celsius mode
    expect(screen.queryByText('75')).not.toBeInTheDocument()
  })

  it('renders the high/low temperature summary', () => {
    render(<WeatherWidget />)
    const summary = screen.getByText(/H:\d+.*L:\d+/)
    expect(summary).toBeInTheDocument()
  })

  it('renders the "Perfect, as always" tagline', () => {
    render(<WeatherWidget />)
    expect(screen.getByText('Perfect, as always')).toBeInTheDocument()
  })

  it('renders with the sky-blue gradient styling', () => {
    const { container } = render(<WeatherWidget />)
    const root = container.firstChild
    expect(root).toHaveClass('bg-gradient-to-br', 'from-sky-400', 'to-blue-500')
  })

  it('ignores unknown units values and defaults to fahrenheit', () => {
    // An invalid units value should fall through to fahrenheit path
    render(<WeatherWidget units="kelvin" />)
    // kelvin is neither 'celsius' nor 'fahrenheit' — the component treats
    // anything non-celsius as fahrenheit, so we should see 75.
    expect(screen.getByText('75')).toBeInTheDocument()
  })
})
