// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NewsPage from './NewsPage'

// v9.25 regen #2 (slow network): an error with cached posts keeps the
// list on screen with the small amber strip (never the full error
// card); a restored cache entry missing pinned/posts renders the empty
// state without throwing; a background refetch shows the stale pill.

const { queryState, mockRefetch } = vi.hoisted(() => ({
  queryState: { news: {} },
  mockRefetch: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts) => {
    const key = Array.isArray(opts.queryKey) ? opts.queryKey[0] : opts.queryKey
    const s = queryState[key] || {}
    return {
      data: s.data,
      isLoading: s.isLoading ?? false,
      isFetching: s.isFetching ?? false,
      isError: s.isError ?? false,
      error: s.error,
      refetch: s.refetch || mockRefetch,
    }
  },
}))

vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ isModerator: false, isAdmin: false, isSuperAdmin: false }) }))
vi.mock('../hooks/useSEO', () => ({ useSEO: () => {} }))
vi.mock('../hooks/useBookmarksDB', () => ({ useBookmarkedSet: () => ({ data: new Set() }) }))
vi.mock('../lib/prefetch', () => ({ fetchNews: vi.fn() }))
vi.mock('../lib/confirmDialog', () => ({ confirmDialog: vi.fn(async () => false) }))
vi.mock('../lib/toast', () => ({ showError: vi.fn() }))
vi.mock('../components/UI', () => ({
  PostCard: ({ post }) => <div data-testid="post-card">{post.title}</div>,
  Skeleton: () => <div data-testid="skeleton" />,
  EmptyState: ({ title }) => <div>{title}</div>,
}))
vi.mock('yet-another-react-lightbox', () => ({ default: () => null }))
vi.mock('yet-another-react-lightbox/plugins/zoom', () => ({ default: {} }))
vi.mock('yet-another-react-lightbox/plugins/thumbnails', () => ({ default: {} }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }) },
}))

const POSTS = [
  { id: 'p1', title: 'Test Post 1', type: 'news' },
  { id: 'p2', title: 'Test Post 2', type: 'news' },
]
const CACHED = { pinned: [], posts: POSTS, hasMore: false }

function setNews(state) {
  queryState.news = { data: CACHED, isLoading: false, isFetching: false, isError: false, refetch: mockRefetch, ...state }
}

function renderNews() {
  return render(
    <MemoryRouter initialEntries={['/news']}>
      <NewsPage />
    </MemoryRouter>,
  )
}

afterEach(() => { cleanup() })

describe('NewsPage 9.25 slow-network', () => {
  beforeEach(() => { mockRefetch.mockClear() })

  it('error with cached posts keeps the list + amber strip, no error card; strip retry refetches', async () => {
    setNews({})
    const { rerender } = renderNews()
    await waitFor(() => expect(screen.getByText('Test Post 1')).toBeTruthy())
    expect(screen.getByText('Test Post 2')).toBeTruthy()

    // Background refetch fails while the cached rows are still held.
    setNews({ data: CACHED, isError: true, error: new Error('slow network') })
    rerender(
      <MemoryRouter initialEntries={['/news']}>
        <NewsPage />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText(/အဟောင်းပြထားသည်/)).toBeTruthy())
    expect(screen.getByText('Test Post 1')).toBeTruthy()
    expect(screen.getByText('Test Post 2')).toBeTruthy()
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('restored data missing pinned/posts renders the empty state without throwing', async () => {
    setNews({ data: {} })
    renderNews()
    await waitFor(() => expect(screen.getByText('သတင်း မရှိသေးပါ')).toBeTruthy())
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
  })

  it('background refetch with cached posts shows the stale pill', async () => {
    setNews({ isFetching: true })
    renderNews()
    await waitFor(() => expect(screen.getByText('Test Post 1')).toBeTruthy())
    expect(screen.getByText(/အသစ်ရယူနေသည်/)).toBeTruthy()
  })
})
