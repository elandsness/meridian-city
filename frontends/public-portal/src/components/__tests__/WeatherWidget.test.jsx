import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import WeatherWidget from '../WeatherWidget'

// Mock useConfig
vi.mock('../../config/ConfigContext', () => ({
  useConfig: () => ({
    company: { name: 'Test Company' },
  }),
}))

describe('WeatherWidget', () => {
  it('renders with default location', () => {
    render(<WeatherWidget />)

    expect(screen.getByText('Test Company')).toBeTruthy()
  })

  it('renders with custom location', () => {
    render(<WeatherWidget location="Custom City" />)

    expect(screen.getByText('Custom City')).toBeTruthy()
  })

  it('uses config company name when no location provided', () => {
    // The component uses useConfig() hook, so the mock returns 'Test Company'
    render(<WeatherWidget />)

    expect(screen.getByText('Test Company')).toBeTruthy()
  })

  it('renders temperature', () => {
    render(<WeatherWidget location="Test City" />)

    // Temperature is rendered in fahrenheit by default (24°C ≈ 75°F)
    const tempElement = document.querySelector('[class*="text-3xl"]')
    expect(tempElement).toBeTruthy()
    expect(tempElement.textContent).toContain('75')
  })

  it('renders temperature in celsius when units=celsius', () => {
    render(<WeatherWidget location="Test City" units="celsius" />)

    // Temperature should be 24°C (check for the large temperature display)
    const tempElement = document.querySelector('[class*="text-3xl"]')
    expect(tempElement).toBeTruthy()
    expect(tempElement.textContent).toContain('24')
  })

  it('renders weather condition', () => {
    render(<WeatherWidget location="Test City" />)

    expect(screen.getByText('Sunny')).toBeTruthy()
  })
})
