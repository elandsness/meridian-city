import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NewsTicker from '../NewsTicker'

describe('NewsTicker', () => {
  it('renders the "Breaking" label', () => {
    render(<NewsTicker />)
    expect(screen.getByText('Breaking')).toBeInTheDocument()
  })

  it('renders the "Meridian News" source label', () => {
    render(<NewsTicker />)
    expect(screen.getByText('Meridian News')).toBeInTheDocument()
  })

  it('displays a default headline from the curated set', () => {
    render(<NewsTicker />)
    // DEFAULT_HEADLINES contains Onion-style headlines; any of them should appear.
    const heading = screen.getByText(/Local Man Returns Library Book|Meridian Pothole|Sun Reportedly|City's Last Grumpy|Meridian Squirrels|Every Single Bus|Local Dog Elected|Meridian Tap Water|Area Toddler|City Park Bench/)
    expect(heading).toBeInTheDocument()
  })

  it('renders custom headlines when provided', () => {
    const custom = ['First headline', 'Second headline']
    render(<NewsTicker headlines={custom} />)
    expect(screen.getByText('First headline')).toBeInTheDocument()
    expect(screen.getByText('Second headline')).toBeInTheDocument()
  })

  it('uses custom headlines instead of defaults when provided', () => {
    const custom = ['Custom only']
    render(<NewsTicker headlines={custom} />)
    expect(screen.getByText('Custom only')).toBeInTheDocument()
    // None of the default headlines should appear
    expect(screen.queryByText(/Local Man Returns Library Book/)).not.toBeInTheDocument()
  })

  it('falls back to defaults when headlines prop is an empty array', () => {
    render(<NewsTicker headlines={[]} />)
    const heading = screen.getByText(/Local Man Returns Library Book|Meridian Pothole|Sun Reportedly/)
    expect(heading).toBeInTheDocument()
  })

  it('falls back to defaults when headlines prop is null', () => {
    render(<NewsTicker headlines={null} />)
    const heading = screen.getByText(/Local Man Returns Library Book|Meridian Pothole|Sun Reportedly/)
    expect(heading).toBeInTheDocument()
  })

  it('falls back to defaults when headlines prop is undefined', () => {
    render(<NewsTicker />)
    const heading = screen.getByText(/Local Man Returns Library Book|Meridian Pothole|Sun Reportedly/)
    expect(heading).toBeInTheDocument()
  })

  it('renders inside a white card with a red border', () => {
    const { container } = render(<NewsTicker />)
    const root = container.firstChild
    expect(root).toHaveClass('bg-white', 'border-slate-200')
  })

  it('renders the red breaking-news badge with a pulsing dot', () => {
    const { container } = render(<NewsTicker />)
    const badge = container.querySelector('.bg-red-600')
    expect(badge).toBeInTheDocument()
    const dot = container.querySelector('.animate-pulse')
    expect(dot).toBeInTheDocument()
  })
})
