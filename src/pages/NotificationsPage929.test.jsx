// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationsPage from './NotificationsPage'

// v9.29 — bulk delete on the Notifications page + "Mark all read"
// always visible (disabled at 0 unread). Follows the AdminPage928
// mocking pattern. The service layer is mocked (no supabase builder
// needed); the page's own optimistic-update + confirm + toast flow is
// what these tests assert.

const now = new Date().toISOString()
const defaultRows = () => ([
  { id: 'n1', type: 'listing_approved', title: 'ဆိုင်အတည်ပြုပြီး ၁', message: 'ဆိုင်ကို အတည်ပြုပြီးပါပြီ', is_read: false, created_at: now },
  { id: 'n2', type: 'new_review', title: 'Review အသစ် ၂', message: 'Review အသစ် ရရှိပါပြီ', is_read: false, created_at: now },
  { id: 'n3', type: 'system_alert', title: 'System ၃', message: 'System မက်ဆေ့ချ်', is_read: true, created_at: now },
])

const { mockAuth, mockConfirm, mockToast, mockNotif } = vi.hoisted(() => ({
  mockAuth: {
    user: { id: 'u1' },
    isLoggedIn: true,
  },
  mockConfirm: { value: true, calls: [] },
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockNotif: {
    rows: [],
    failDeleteIds: [],
    deletedIds: [],
    markAllCalls: [],
  },
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }))
vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../hooks/useSEO', () => ({ useSEO: () => {} }))
vi.mock('../lib/confirmDialog', () => ({
  confirmDialog: vi.fn(async (...args) => { mockConfirm.calls.push(args); return mockConfirm.value }),
}))
vi.mock('../lib/toast', () => ({ showError: (...a) => mockToast.error(...a), showSuccess: (...a) => mockToast.success(...a) }))
vi.mock('../lib/notificationService', () => ({
  getUserNotifications: vi.fn(async () => mockNotif.rows),
  markNotificationAsRead: vi.fn(async () => {}),
  markAllNotificationsAsRead: vi.fn(async (userId) => { mockNotif.markAllCalls.push(userId) }),
  deleteNotification: vi.fn(async (id) => {
    if (mockNotif.failDeleteIds.includes(id)) throw new Error('delete failed')
    mockNotif.deletedIds.push(id)
  }),
  subscribeToNotifications: vi.fn(() => ({ unsubscribe: vi.fn() })),
}))

beforeEach(() => {
  mockNotif.rows = defaultRows()
  mockNotif.failDeleteIds = []
  mockNotif.deletedIds = []
  mockNotif.markAllCalls = []
  mockConfirm.value = true
  mockConfirm.calls = []
  mockToast.success.mockClear()
  mockToast.error.mockClear()
})

afterEach(() => { cleanup() })

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <NotificationsPage />
    </MemoryRouter>,
  )
}

async function waitForRows() {
  await waitFor(() => expect(screen.getByText('ဆိုင်အတည်ပြုပြီး ၁')).toBeTruthy())
  expect(screen.getByText('Review အသစ် ၂')).toBeTruthy()
  expect(screen.getByText('System ၃')).toBeTruthy()
}

function rowCheckboxes() {
  return screen.getAllByLabelText('ရွေးမည်')
}

describe('v9.29 bulk delete: Notifications page', () => {
  it('happy path: 2 ticked rows deleted, list shrinks, one success toast', async () => {
    renderPage()
    await waitForRows()
    const boxes = rowCheckboxes()
    expect(boxes).toHaveLength(3)
    fireEvent.click(boxes[0])
    fireEvent.click(boxes[1])
    expect(screen.getByText('2 ခု ရွေးထားသည်')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /အပြီးဖျက်မည်/ }))
    await waitFor(() => expect(mockNotif.deletedIds).toEqual(['n1', 'n2']))
    expect(screen.queryByText('ဆိုင်အတည်ပြုပြီး ၁')).toBeNull()
    expect(screen.queryByText('Review အသစ် ၂')).toBeNull()
    expect(screen.getByText('System ၃')).toBeTruthy()
    expect(mockToast.success).toHaveBeenCalledWith('✓ အသိပေးချက် 2 ခု ဖျက်ပြီးပါပြီ')
    // Succeeded ids are cleared from the selection.
    expect(screen.getByText('0 ခု ရွေးထားသည်')).toBeTruthy()
  })

  it('partial failure: failed row stays (and stays selected), error toast counts both', async () => {
    mockNotif.failDeleteIds = ['n2']
    renderPage()
    await waitForRows()
    const boxes = rowCheckboxes()
    fireEvent.click(boxes[0])
    fireEvent.click(boxes[1])
    fireEvent.click(screen.getByRole('button', { name: /အပြီးဖျက်မည်/ }))
    await waitFor(() => expect(mockNotif.deletedIds).toEqual(['n1']))
    expect(screen.queryByText('ဆိုင်အတည်ပြုပြီး ၁')).toBeNull()
    expect(screen.getByText('Review အသစ် ၂')).toBeTruthy()
    expect(mockToast.error).toHaveBeenCalled()
    expect(mockToast.error.mock.calls[0][0]).toContain('ဖျက်မရတာ 1 ခု')
    expect(mockToast.error.mock.calls[0][0]).toContain('1 ခု ဖျက်ပြီးပါပြီ')
    // The failed row stays selected for retry.
    expect(rowCheckboxes().filter(c => c.checked)).toHaveLength(1)
    expect(screen.getByText('1 ခု ရွေးထားသည်')).toBeTruthy()
  })

  it('confirm declined: zero deletes, list unchanged, no toast', async () => {
    mockConfirm.value = false
    renderPage()
    await waitForRows()
    fireEvent.click(rowCheckboxes()[0])
    fireEvent.click(screen.getByRole('button', { name: /အပြီးဖျက်မည်/ }))
    await waitFor(() => expect(mockConfirm.calls.length).toBe(1))
    expect(mockNotif.deletedIds).toEqual([])
    expect(screen.getByText('ဆိုင်အတည်ပြုပြီး ၁')).toBeTruthy()
    expect(mockToast.success).not.toHaveBeenCalled()
    expect(mockToast.error).not.toHaveBeenCalled()
  })

  it('select-all ticks every visible row', async () => {
    renderPage()
    await waitForRows()
    fireEvent.click(screen.getByLabelText('စာရင်းပါ အားလုံး ရွေးမည်'))
    expect(screen.getByText('3 ခု ရွေးထားသည်')).toBeTruthy()
    expect(rowCheckboxes().every(c => c.checked)).toBe(true)
  })

  it('bulk-delete button is disabled with nothing selected', async () => {
    renderPage()
    await waitForRows()
    expect(screen.getByRole('button', { name: /အပြီးဖျက်မည်/ }).disabled).toBe(true)
  })
})

describe('v9.29 mark all read: always visible', () => {
  it('present but disabled at 0 unread', async () => {
    mockNotif.rows = defaultRows().map(r => ({ ...r, is_read: true }))
    renderPage()
    await waitFor(() => expect(screen.getByText('System ၃')).toBeTruthy())
    const btn = screen.getByRole('button', { name: /အားလုံးဖတ်ပြီးဟု မှတ်မည်/ })
    expect(btn).toBeTruthy()
    expect(btn.disabled).toBe(true)
  })

  it('enabled with unread rows; click marks all read', async () => {
    renderPage()
    await waitForRows()
    const btn = screen.getByRole('button', { name: /အားလုံးဖတ်ပြီးဟု မှတ်မည်/ })
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    await waitFor(() => expect(mockNotif.markAllCalls).toEqual(['u1']))
    expect(screen.getByText('3 ခု • 0 ဖတ်မရသေး')).toBeTruthy()
  })
})
