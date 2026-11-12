// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import { ListingCard } from './UI'

// v9.39: ListingCard is wrapped in React.memo — a re-render of the
// parent with IDENTICAL props must not re-invoke the card body. The
// body calls getOptimizedUrl once per render (logo_url set), so the
// call count is the render count. A changed `listing` prop must
// still re-render (memo is not a freeze).
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons), so the 9.19/9.25
// backslash-path rule does not apply here — stated explicitly per
// the brief.

const { getOptimizedUrlMock } = vi.hoisted(() => ({
  getOptimizedUrlMock: vi.fn((url) => `https://img.test/${url}`),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: false }),
}))

vi.mock('../hooks/useBookmarksDB', () => ({
  useIsBookmarked: () => ({ data: false }),
  useAddBookmark: () => ({ isPending: false, mutate: vi.fn() }),
  useRemoveBookmark: () => ({ isPending: false, mutate: vi.fn() }),
}))

vi.mock('../lib/cloudinary', () => ({
  getOptimizedUrl: (...args) => getOptimizedUrlMock(...args),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {},
}))

const LISTING = {
  id: 'row-1',
  name: 'Car Rental 1',
  name_mm: 'Car Rental 1',
  city: 'Taunggyi',
  rating_avg: 4.5,
  rating_count: 2,
  logo_url: 'https://example.com/logo.png',
  category: { name: 'Car Rental', name_mm: 'ကားငှားဝန်ဆောင်မှု', icon: '🚗' },
}

function Parent() {
  const [tick, setTick] = useState(0)
  const [listing, setListing] = useState(LISTING)
  return (
    <>
      <button onClick={() => setTick((t) => t + 1)}>bump {tick}</button>
      <button onClick={() => setListing({ ...listing, name: 'Changed Name' })}>change</button>
      <ListingCard listing={listing} bookmarked={false} />
    </>
  )
}

beforeEach(() => {
  cleanup()
  getOptimizedUrlMock.mockClear()
})

afterEach(() => { cleanup() })

describe('v9.39 ListingCard React.memo', () => {
  it('parent re-renders with identical props do not re-invoke the card body; a changed listing prop does', () => {
    render(
      <MemoryRouter>
        <Parent />
      </MemoryRouter>
    )
    expect(screen.getByText('Car Rental 1')).toBeTruthy()
    expect(getOptimizedUrlMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText(/bump/))
    fireEvent.click(screen.getByText(/bump/))
    fireEvent.click(screen.getByText(/bump/))
    expect(screen.getByText('Car Rental 1')).toBeTruthy()
    expect(getOptimizedUrlMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('change'))
    expect(screen.getByText('Changed Name')).toBeTruthy()
    expect(getOptimizedUrlMock).toHaveBeenCalledTimes(2)
  })
})
