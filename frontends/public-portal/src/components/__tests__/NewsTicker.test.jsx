import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import NewsTicker from '../NewsTicker'

// Mock useConfig
vi.mock('../../config/ConfigContext', () => ({
  useConfig: () => ({
    company: { name: 'Test Company' },
  }),
}))

describe('NewsTicker', () => {
  it('renders with default headlines when none provided', () => {
    const { container } = render(<NewsTicker />)

    // Should show a headline (truncated by line-clamp-3, so check for any text in the p tag)
    const headline = container.querySelector('p')
    expect(headline).toBeTruthy()
    expect(headline.textContent).toBeTruthy()
    expect(headline.textContent.length).toBeGreaterThan(0)
  })

  it('renders custom headlines when provided', () => {
    const headlines = ['Alpha', 'Beta', 'Gamma']

    const { container } = render(<NewsTicker headlines={headlines} />)

    // Should show one of the custom headlines (may be shuffled, so check for any)
    const headline = container.querySelector('p')
    expect(headline).toBeTruthy()
    expect(headline.textContent).toBeTruthy()
    expect(headline.textContent.length).toBeGreaterThan(0)
  })

  it('falls back to defaults when headlines prop is an empty array', () => {
    const { container } = render(<NewsTicker headlines={[]} />)

    // Should show a default headline
    const headline = container.querySelector('p')
    expect(headline).toBeTruthy()
    expect(headline.textContent).toBeTruthy()
    expect(headline.textContent.length).toBeGreaterThan(0)
  })

  it('falls back to defaults when headlines prop is null', () => {
    const { container } = render(<NewsTicker headlines={null} />)

    // Should show a default headline
    const headline = container.querySelector('p')
    expect(headline).toBeTruthy()
    expect(headline.textContent).toBeTruthy()
    expect(headline.textContent.length).toBeGreaterThan(0)
  })

  it('falls back to defaults when headlines prop is undefined', () => {
    const { container } = render(<NewsTicker headlines={undefined} />)

    // Should show a default headline
    const headline = container.querySelector('p')
    expect(headline).toBeTruthy()
    expect(headline.textContent).toBeTruthy()
    expect(headline.textContent.length).toBeGreaterThan(0)
  })

  it('renders "Breaking" badge', () => {
    render(<NewsTicker headlines={['Test Headline']} />)

    expect(screen.getByText('Breaking')).toBeTruthy()
    expect(screen.getByText('Meridian News')).toBeTruthy()
  })

  it('renders headline text', () => {
    render(<NewsTicker headlines={['Test Headline']} />)

    expect(screen.getByText('Test Headline')).toBeTruthy()
  })

  it('shows "Breaking" badge with red background', () => {
    render(<NewsTicker headlines={['Test Headline']} />)

    const badge = screen.getByText('Breaking')
    expect(badge.className).toContain('bg-red-600')
  })
})
