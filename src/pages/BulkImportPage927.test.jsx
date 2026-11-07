// @vitest-environment jsdom
// v9.27 — BulkImportPage: per-row retry, surfaced insert errors,
// name+city fallback dedupe for rows with no strict key.
// (a) A THROWN (rejected) insert is retried once after a short delay —
//     after re-checking live by strict dedupe key, so a commit whose
//     response was lost counts as success instead of duplicating.
//     A fulfilled-with-error insert is NEVER retried (the DB rejected
//     the row; retrying cannot help). (b) The per-row error line keeps
//     the Burmese label but appends the real Supabase detail.
// (c) Rows with no phone, township or address used to have NO dedupe
//     key (dedupeKey returns null) — 12 such rows went live in the
//     874-row sm3 import with nothing to dedupe a re-import against.
//     They now fall back to name+city in the dedupe set.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BulkImportPage, {
  dedupeKeyWithFallback,
  fallbackDedupeKey,
  describeInsertError,
} from './BulkImportPage'

const { mockAuth, mockDB, longTaskCalls, mockLog } = vi.hoisted(() => ({
  mockAuth: { profile: { id: 'u1' }, user: { id: 'u1' }, isAdmin: true, isModerator: false, loading: false },
  mockDB: { inserts: [], insertAttempts: [], insertBehavior: {}, insertRetried: {}, bulkInserts: [], bulkUpdates: [], existingListings: [], bulkImportId: 'imp-1' },
  longTaskCalls: { begin: 0, end: 0 },
  mockLog: (...args) => { mockLog.calls.push(args); return Promise.resolve(true) },
}))
mockLog.calls = []

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }))
vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ cities: ['Taunggyi'], app_city: 'တောင်ကြီးမြို့' }),
}))
vi.mock('../hooks/useSEO', () => ({ useSEO: () => {} }))
vi.mock('../hooks/useAuditLog', () => ({ useAuditLog: () => ({ log: mockLog }) }))
vi.mock('../lib/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))
vi.mock('../lib/longTask.js', () => ({
  beginLongTask: () => { longTaskCalls.begin += 1 },
  endLongTask: () => { longTaskCalls.end += 1 },
  isLongTaskRunning: () => longTaskCalls.begin > longTaskCalls.end,
}))

// Chainable supabase builder (mirrors BulkImportPage926.test.jsx):
// categories + dedupe select are thenables, bulk_imports insert chains
// .select().single(), listings insert is a plain promise whose outcome
// is driven per-row by mockDB.insertBehavior.
vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table) {
      const b = {
        select() { return b },
        eq() { return b },
        order() { return b },
        range() { return b },
        single() {
          if (table === 'bulk_imports') return Promise.resolve({ data: { id: mockDB.bulkImportId }, error: null })
          return Promise.resolve({ data: null, error: null })
        },
        insert(row) {
          if (table === 'listings') {
            mockDB.insertAttempts.push(row.name)
            const behavior = mockDB.insertBehavior[row.name]
            if (behavior === 'throw-once') {
              if (!mockDB.insertRetried[row.name]) {
                mockDB.insertRetried[row.name] = true
                return Promise.reject(new Error('fetch failed'))
              }
              mockDB.inserts.push(row)
              return Promise.resolve({ error: null })
            }
            if (behavior === 'throw-always') return Promise.reject(new Error('fetch failed'))
            if (behavior === 'throw-once-then-live') {
              if (!mockDB.insertRetried[row.name]) {
                mockDB.insertRetried[row.name] = true
                // The row committed server-side; only its response was
                // lost — the retry's live check must find it.
                mockDB.existingListings.push({
                  name: row.name, phone_1: row.phone_1, township: row.township,
                  address_mm: row.address_mm, city: row.city,
                })
                return Promise.reject(new Error('fetch failed'))
              }
              mockDB.inserts.push(row)
              return Promise.resolve({ error: null })
            }
            if (behavior === 'error-always') {
              return Promise.resolve({ error: { message: 'new row violates row-level security policy for table "listings"', code: '42501' } })
            }
            mockDB.inserts.push(row)
            return Promise.resolve({ error: null })
          }
          if (table === 'bulk_imports') { mockDB.bulkInserts.push(row); return b }
          return Promise.resolve({ error: null })
        },
        update(payload) { mockDB.bulkUpdates.push(payload); return b },
        then(resolve, reject) {
          let result
          if (table === 'categories') result = { data: [
            { id: 'c1', name: 'Food', name_mm: 'စား', type: 'directory' },
          ], error: null }
          else if (table === 'listings') result = { data: mockDB.existingListings, error: null }
          else result = { data: null, error: null }
          return Promise.resolve(result).then(resolve, reject)
        },
      }
      return b
    },
  },
}))

function csvFile(text, name = 'shops.csv') {
  return new File([text], name, { type: 'text/csv' })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <BulkImportPage />
    </MemoryRouter>,
  )
}

async function selectFile(container, file, rowCount) {
  const input = container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(
    () => expect(screen.getByText(new RegExp(`${rowCount} rows detected`))).toBeTruthy(),
    { timeout: 5000 },
  )
}

async function importFile(container, file, rowCount, buttonRe) {
  await selectFile(container, file, rowCount)
  fireEvent.click(screen.getByText(buttonRe))
  await waitFor(() => expect(screen.getByText(/Import ပြီးပါပြီ/)).toBeTruthy(), { timeout: 10000 })
}

beforeEach(() => {
  localStorage.clear()
  mockDB.inserts = []
  mockDB.insertAttempts = []
  mockDB.insertBehavior = {}
  mockDB.insertRetried = {}
  mockDB.bulkInserts = []
  mockDB.bulkUpdates = []
  mockDB.existingListings = []
  mockDB.bulkImportId = 'imp-1'
  longTaskCalls.begin = 0
  longTaskCalls.end = 0
  mockLog.calls = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('v9.27: fallback dedupe key + error detail (unit)', () => {
  it('strict key wins when a phone exists; township+address discriminates without one', () => {
    expect(dedupeKeyWithFallback('Shop', '09123456789', '', '', 'Taunggyi')).toBe('shop|09123456789')
    expect(dedupeKeyWithFallback('Shop', '', 'Aung Chan Tha', 'Some street', 'Taunggyi')).toBe('shop|aung chan tha|some street')
  })

  it('no phone, township or address → name+city fallback (never null)', () => {
    expect(dedupeKeyWithFallback('NoPhone Shop', '', '', '', 'Taunggyi')).toBe('nophone shop|taunggyi')
    expect(dedupeKeyWithFallback('NoPhone Shop', '', '', '', 'Yangon')).toBe('nophone shop|yangon')
    expect(fallbackDedupeKey('  Twin Shop ', 'Yangon')).toBe('twin shop|yangon')
  })

  it('describeInsertError keeps message + code, tolerates strings and null', () => {
    expect(describeInsertError({ message: 'RLS denied', code: '42501' })).toBe('RLS denied [code 42501]')
    expect(describeInsertError({ message: 'boom' })).toBe('boom')
    expect(describeInsertError(new Error('fetch failed'))).toBe('fetch failed')
    expect(describeInsertError('plain string')).toBe('plain string')
    expect(describeInsertError(null)).toBe('Insert failed')
  })
})

describe('v9.27: bounded retry of thrown inserts (render)', () => {
  const CSV_FLAKY = [
    'name,category,phone_1,township,address_mm',
    'Flaky Shop,Food,09111111111,,',
    'Steady Shop,Food,09222222222,,',
  ].join('\n')

  it('fail-once-then-succeed (thrown) → row succeeds after one retry', async () => {
    mockDB.insertBehavior = { 'Flaky Shop': 'throw-once' }
    const { container } = renderPage()
    await importFile(container, csvFile(CSV_FLAKY), 2, /2 လုပ်ငန်း Import လုပ်မည်/)
    // Both rows live; the flaky one took two attempts.
    expect(mockDB.inserts.map(r => r.name).sort()).toEqual(['Flaky Shop', 'Steady Shop'])
    expect(mockDB.insertAttempts.filter(n => n === 'Flaky Shop')).toHaveLength(2)
    expect(mockDB.insertAttempts.filter(n => n === 'Steady Shop')).toHaveLength(1)
    expect(screen.queryByText(/Errors/)).toBeNull()
    const lastUpdate = mockDB.bulkUpdates[mockDB.bulkUpdates.length - 1]
    expect(lastUpdate.row_success).toBe(2)
    expect(lastUpdate.row_failed).toBe(0)
  })

  it('committed-but-response-lost → counted as success, NOT re-inserted', async () => {
    mockDB.insertBehavior = { 'Ghost Shop': 'throw-once-then-live' }
    const csv = [
      'name,category,phone_1,township,address_mm',
      'Ghost Shop,Food,09111111111,,',
    ].join('\n')
    const { container } = renderPage()
    await importFile(container, csvFile(csv), 1, /1 လုပ်ငန်း Import လုပ်မည်/)
    // Exactly one insert attempt: the retry's live check found the
    // committed row and did not fire a second insert.
    expect(mockDB.insertAttempts).toEqual(['Ghost Shop'])
    expect(mockDB.inserts).toHaveLength(0)
    expect(screen.queryByText(/Errors/)).toBeNull()
    const lastUpdate = mockDB.bulkUpdates[mockDB.bulkUpdates.length - 1]
    expect(lastUpdate.row_success).toBe(1)
    expect(lastUpdate.row_failed).toBe(0)
  })

  it('throw-always → fails after the single retry, error shows the real detail', async () => {
    mockDB.insertBehavior = { 'Dead Shop': 'throw-always' }
    const csv = [
      'name,category,phone_1,township,address_mm',
      'Dead Shop,Food,09111111111,,',
      'Steady Shop,Food,09222222222,,',
    ].join('\n')
    const { container } = renderPage()
    await importFile(container, csvFile(csv), 2, /2 လုပ်ငန်း Import လုပ်မည်/)
    // Two attempts total (first + one retry), then a real failure.
    expect(mockDB.insertAttempts.filter(n => n === 'Dead Shop')).toHaveLength(2)
    expect(mockDB.inserts.map(r => r.name)).toEqual(['Steady Shop'])
    expect(screen.getByText(/Errors \(1\)/)).toBeTruthy()
    expect(screen.getByText(/Row 2: ထည့်သွင်းမရပါ \(fetch failed\)/)).toBeTruthy()
    const lastUpdate = mockDB.bulkUpdates[mockDB.bulkUpdates.length - 1]
    expect(lastUpdate.row_success).toBe(1)
    expect(lastUpdate.row_failed).toBe(1)
  })
})

describe('v9.27: fulfilled-with-error is NOT retried and shows the DB detail (render)', () => {
  it('DB rejection fails once with the real message + code', async () => {
    mockDB.insertBehavior = { 'Blocked Shop': 'error-always' }
    const csv = [
      'name,category,phone_1,township,address_mm',
      'Blocked Shop,Food,09111111111,,',
      'Steady Shop,Food,09222222222,,',
    ].join('\n')
    const { container } = renderPage()
    await importFile(container, csvFile(csv), 2, /2 လုပ်ငန်း Import လုပ်မည်/)
    // No retry: the DB rejected the row, so a second identical
    // insert could not help.
    expect(mockDB.insertAttempts.filter(n => n === 'Blocked Shop')).toHaveLength(1)
    expect(mockDB.inserts.map(r => r.name)).toEqual(['Steady Shop'])
    expect(screen.getByText(/Row 2: ထည့်သွင်းမရပါ \(new row violates row-level security policy for table "listings" \[code 42501\]\)/)).toBeTruthy()
  })
})

describe('v9.27: null-key rows — name+city fallback dedupe (render)', () => {
  it('null-key row already live (same name+city) → skipped on re-import, not duplicated', async () => {
    // The row went live in an earlier run: no phone, no township, no
    // address — the old code had no key for it at all.
    mockDB.existingListings = [
      { name: 'NoPhone Shop', phone_1: null, township: null, address_mm: null, city: 'Taunggyi' },
    ]
    const csv = [
      'name,category,phone_1,township,address_mm',
      'NoPhone Shop,Food,,,',
      'Fresh Shop,Food,09111111111,,',
    ].join('\n')
    const { container } = renderPage()
    await importFile(container, csvFile(csv), 2, /2 လုပ်ငန်း Import လုပ်မည်/)
    expect(mockDB.inserts.map(r => r.name)).toEqual(['Fresh Shop'])
    expect(mockDB.insertAttempts).toEqual(['Fresh Shop'])
    expect(screen.getByText(/Row 2: "NoPhone Shop" ထပ်နေသည်/)).toBeTruthy()
  })

  it('null-key rows with distinct names/cities — incl. same name, different city — are all inserted', async () => {
    const csv = [
      'name,category,city,phone_1,township,address_mm',
      'Twin Shop,Food,Taunggyi,,,',
      'Twin Shop,Food,Yangon,,,',
      'Solo Shop,Food,,,,',
    ].join('\n')
    const { container } = renderPage()
    await importFile(container, csvFile(csv), 3, /3 လုပ်ငန်း Import လုပ်မည်/)
    expect(mockDB.inserts).toHaveLength(3)
    expect(mockDB.inserts.map(r => r.name + '@' + r.city).sort()).toEqual([
      'Solo Shop@Taunggyi',
      'Twin Shop@Taunggyi',
      'Twin Shop@Yangon',
    ])
    expect(screen.queryByText(/Skipped — ထပ်နေလို့/)).toBeNull()
  })
})
