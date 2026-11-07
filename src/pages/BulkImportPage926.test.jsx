// @vitest-environment jsdom
// v9.26 — BulkImportPage: points text fix + import persist/resume.
// (1) The false "အမှတ် မရပါ" line is gone; imports earn +10 on import
//     and +20 more on approval. (2) A checkpoint is saved to localStorage
//     after every chunk; a reload mid-import resumes from the persisted
//     next row index — skipped BY INDEX, not by dedupe alone (rows with
//     no phone and no township/address have no dedupe key and would
//     duplicate on a dedupe-only resume). Cancel / discard / completion
//     clear the checkpoint. A beforeunload guard warns mid-import, and
//     the import registers as a long task (longTask.js contract).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import BulkImportPage, {
  BULK_IMPORT_CHECKPOINT_KEY,
  loadBulkImportCheckpoint,
  saveBulkImportCheckpoint,
  clearBulkImportCheckpoint,
  checkpointFileMatches,
} from './BulkImportPage'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

const { mockAuth, mockDB, longTaskCalls, mockLog } = vi.hoisted(() => ({
  mockAuth: { profile: { id: 'u1' }, user: { id: 'u1' }, isAdmin: true, isModerator: false, loading: false },
  mockDB: { inserts: [], bulkInserts: [], bulkUpdates: [], existingListings: [], bulkImportId: 'imp-1' },
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

// Chainable supabase builder: categories + dedupe select are thenables,
// bulk_imports insert chains .select().single(), listings insert is a
// plain promise, bulk_imports update chains .eq() and is thenable.
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
          if (table === 'listings') { mockDB.inserts.push(row); return Promise.resolve({ error: null }) }
          if (table === 'bulk_imports') { mockDB.bulkInserts.push(row); return b }
          return Promise.resolve({ error: null })
        },
        update(payload) { mockDB.bulkUpdates.push(payload); return b },
        then(resolve, reject) {
          let result
          if (table === 'categories') result = { data: [
            { id: 'c1', name: 'Food', name_mm: 'စား', type: 'directory' },
            // v9.26: sm3 categories (created by supabase-migration-9.26.sql)
            { id: 'c2', name: 'Real Estate', name_mm: 'အိမ်ခြံမြေ', type: 'directory' },
            { id: 'c3', name: 'Car Rental Service', name_mm: 'ကားငှားဝန်ဆောင်မှု', type: 'directory' },
            { id: 'c4', name: 'Insurance', name_mm: 'အာမခံ', type: 'directory' },
            { id: 'c5', name: 'Local Employment Service', name_mm: 'ပြည်တွင်းအလုပ်အကိုင်', type: 'directory' },
            // Live-only category the sm3 module cannot know — proves the
            // fallback to the existing catMap lookup still works.
            { id: 'c6', name: 'Custom Admin Cat', name_mm: 'စိတ်ကြိုက်', type: 'directory' },
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

const CSV_3 = [
  'name,category,phone_1,township,address_mm',
  'NoPhone Shop,Food,,,',
  'Shop Two,Food,09123456789,Aung Chan Tha,Some street',
  'Shop Three,Food,09987654321,,',
].join('\n')

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
  // FileReader parses async — wait for the real row count, not the
  // initial "0 rows detected" paint.
  await waitFor(
    () => expect(screen.getByText(new RegExp(`${rowCount} rows detected`))).toBeTruthy(),
    { timeout: 5000 },
  )
}

beforeEach(() => {
  localStorage.clear()
  mockDB.inserts = []
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

describe('v9.26: points text (source)', () => {
  it('the false "အမှတ် မရပါ" line and the Issue 3a comment are gone; the earning line is present', () => {
    const src = read('pages/BulkImportPage.jsx')
    expect(src).not.toContain('အမှတ် မရပါ')
    expect(src).not.toContain('Issue 3a')
    expect(src).not.toContain('seed data, not the importer')
    expect(src).toContain('အမှတ် +10 ရပြီး')
    expect(src).toContain('+20 ထပ်ရမည်')
  })

  it('the import still submits as the importer (points trigger input)', () => {
    const src = read('pages/BulkImportPage.jsx')
    expect(src).toContain('submitted_by: profile.id')
    expect(src).toContain("status: 'pending'")
  })
})

describe('v9.26: checkpoint helpers (unit)', () => {
  it('save → load round-trips, and lists are bounded to the first 50 entries', () => {
    const errors = Array.from({ length: 60 }, (_, i) => ({ row: i + 2, field: '-', message: 'x' }))
    saveBulkImportCheckpoint({
      version: 1, fileName: 'shops.csv', fileSize: 123, fileLastModified: 456,
      nextIndex: 20, total: 25, success: 20, failed: 0,
      errors, skipped: [], importId: 'imp-1', batchId: 'b1',
    })
    const cp = loadBulkImportCheckpoint()
    expect(cp.nextIndex).toBe(20)
    expect(cp.success).toBe(20)
    expect(cp.importId).toBe('imp-1')
    expect(cp.errors).toHaveLength(50)
    expect(cp.errors[0].row).toBe(2)
  })

  it('clear removes the checkpoint; garbage / wrong-version payloads load as null', () => {
    saveBulkImportCheckpoint({ version: 1, fileName: 'a.csv', nextIndex: 1 })
    expect(loadBulkImportCheckpoint()).not.toBeNull()
    clearBulkImportCheckpoint()
    expect(loadBulkImportCheckpoint()).toBeNull()
    localStorage.setItem(BULK_IMPORT_CHECKPOINT_KEY, '{not json')
    expect(loadBulkImportCheckpoint()).toBeNull()
    localStorage.setItem(BULK_IMPORT_CHECKPOINT_KEY, JSON.stringify({ version: 2, fileName: 'a.csv', nextIndex: 1 }))
    expect(loadBulkImportCheckpoint()).toBeNull()
  })

  it('checkpointFileMatches requires the same name, size and lastModified', () => {
    const cp = { fileName: 'shops.csv', fileSize: 100, fileLastModified: 999 }
    expect(checkpointFileMatches(cp, { name: 'shops.csv', size: 100, lastModified: 999 })).toBe(true)
    expect(checkpointFileMatches(cp, { name: 'other.csv', size: 100, lastModified: 999 })).toBe(false)
    expect(checkpointFileMatches(cp, { name: 'shops.csv', size: 101, lastModified: 999 })).toBe(false)
    expect(checkpointFileMatches(cp, { name: 'shops.csv', size: 100, lastModified: 1000 })).toBe(false)
    expect(checkpointFileMatches(null, { name: 'shops.csv', size: 100, lastModified: 999 })).toBe(false)
  })
})

describe('v9.26: Resume banner (render)', () => {
  it('a stored checkpoint shows the banner with file name + next row; Discard clears it', async () => {
    const file = csvFile(CSV_3)
    saveBulkImportCheckpoint({
      version: 1, fileName: file.name, fileSize: file.size, fileLastModified: file.lastModified,
      nextIndex: 1, total: 3, success: 1, failed: 0, errors: [], skipped: [],
      importId: 'imp-1', batchId: 'b1',
    })
    renderPage()
    expect(screen.getByText(/Import တစ်ဝက် ရပ်နေသည်/)).toBeTruthy()
    expect(screen.getByText(/shops\.csv/)).toBeTruthy()
    expect(screen.getByText(/row 2 မှ 3 အထိ/)).toBeTruthy()
    fireEvent.click(screen.getByText('Discard'))
    await waitFor(() => expect(screen.queryByText(/Import တစ်ဝက် ရပ်နေသည်/)).toBeNull())
    expect(loadBulkImportCheckpoint()).toBeNull()
  })

  it('no checkpoint → no banner', () => {
    renderPage()
    expect(screen.queryByText(/Import တစ်ဝက် ရပ်နေသည်/)).toBeNull()
  })
})

describe('v9.26: resume skips by index (render)', () => {
  it('resuming from row 2 inserts only rows 2–3 — the no-phone row 1 is NOT duplicated', async () => {
    const file = csvFile(CSV_3)
    // Interrupted run: row 1 (NoPhone Shop — no phone, no township,
    // no address, so NO dedupe key) was already inserted; the
    // checkpoint says the next row is index 1 (row 2).
    saveBulkImportCheckpoint({
      version: 1, fileName: file.name, fileSize: file.size, fileLastModified: file.lastModified,
      nextIndex: 1, total: 3, success: 1, failed: 0, errors: [], skipped: [],
      importId: 'imp-1', batchId: 'b1',
    })
    const { container } = renderPage()
    // Banner Resume → no preview yet, so it asks for the file again;
    // picking the same file offers resume on the preview button.
    fireEvent.click(screen.getByText('Resume import'))
    await selectFile(container, file, 3)
    // The preview button now offers resume from row 2.
    expect(screen.getByText(/Resume import — row/)).toBeTruthy()
    // The earning line renders with the preview (points fix, live).
    expect(screen.getByText(/အမှတ် \+10 ရပြီး/)).toBeTruthy()
    expect(screen.getByText(/\+20 ထပ်ရမည်/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Resume import — row/))
    await waitFor(() => expect(screen.getByText(/Import ပြီးပါပြီ/)).toBeTruthy(), { timeout: 5000 })

    // Only the two remaining rows were inserted — NoPhone Shop was
    // skipped BY INDEX (dedupe could not have caught it: no key).
    expect(mockDB.inserts.map(r => r.name)).toEqual(['Shop Two', 'Shop Three'])
    // The resumed run reuses the old bulk_imports row and finishes it.
    expect(mockDB.bulkInserts).toHaveLength(0)
    const lastUpdate = mockDB.bulkUpdates[mockDB.bulkUpdates.length - 1]
    expect(lastUpdate.status).toBe('done')
    expect(lastUpdate.row_success).toBe(3) // 1 restored + 2 new
    // Completion clears the checkpoint and ends the long task.
    expect(loadBulkImportCheckpoint()).toBeNull()
    expect(longTaskCalls.begin).toBe(1)
    expect(longTaskCalls.end).toBe(1)
  })

  it('re-selecting the same file on its own offers resume on the preview button', async () => {
    const file = csvFile(CSV_3)
    saveBulkImportCheckpoint({
      version: 1, fileName: file.name, fileSize: file.size, fileLastModified: file.lastModified,
      nextIndex: 1, total: 3, success: 1, failed: 0, errors: [], skipped: [],
      importId: 'imp-1', batchId: 'b1',
    })
    const { container } = renderPage()
    // No banner tap this time — just pick the file again.
    await selectFile(container, file, 3)
    expect(screen.getByText(/Resume import — row/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Resume import — row/))
    await waitFor(() => expect(screen.getByText(/Import ပြီးပါပြီ/)).toBeTruthy(), { timeout: 5000 })
    expect(mockDB.inserts.map(r => r.name)).toEqual(['Shop Two', 'Shop Three'])
    expect(loadBulkImportCheckpoint()).toBeNull()
  })
})

describe('v9.26: sm3 category mapping (render)', () => {
  const CSV_SM3 = [
    'name,category,phone_1,township,address_mm',
    'Estate One,Real Estate,09111111111,,',
    'Rental One,Car Rental Service,09222222222,,',
    'Insure One,Insurance Agent,09333333333,,',
    'Jobs One,Local Employment Service; Real Estate,09444444444,,',
    'Admin Cat Shop,Custom Admin Cat,09555555555,,',
    'Food Shop,Food,09666666666,,',
    'Mystery Shop,Some Unknown Category,09777777777,,',
  ].join('\n')

  it('sm3 raw values resolve to the right Directory category; unknown fails per-row, never silently အထွေထွေ', async () => {
    const file = csvFile(CSV_SM3, 'sm3.csv')
    const { container } = renderPage()
    await selectFile(container, file, 7)
    fireEvent.click(screen.getByText(/7 လုပ်ငန်း Import လုပ်မည်/))
    await waitFor(() => expect(screen.getByText(/Import ပြီးပါပြီ/)).toBeTruthy(), { timeout: 8000 })

    // 6 of 7 rows inserted; the unknown-category row was NOT inserted.
    expect(mockDB.inserts).toHaveLength(6)
    const byName = Object.fromEntries(mockDB.inserts.map(r => [r.name, r.category_id]))
    expect(byName['Estate One']).toBe('c2') // Real Estate — exact sm3 value
    expect(byName['Rental One']).toBe('c3') // Car Rental Service — exact sm3 value
    expect(byName['Insure One']).toBe('c4') // 'Insurance Agent' → Insurance
    expect(byName['Jobs One']).toBe('c5') // ';'-list → FIRST segment only
    expect(byName['Admin Cat Shop']).toBe('c6') // live-only category via fallback
    expect(byName['Food Shop']).toBe('c1') // existing exact match, as before
    expect(byName['Mystery Shop']).toBeUndefined()
    // No inserted row fell back to အထွေထွေ (no such category id exists
    // in the mock, and the unknown row failed instead of importing).
    expect(Object.values(byName)).not.toContain('အထွေထွေ')

    // The unknown row is listed as a per-row failure, not swallowed.
    expect(screen.getByText(/Row 8: Category "Some Unknown Category" not found/)).toBeTruthy()
    expect(screen.getByText(/Errors \(1\)/)).toBeTruthy()
  })
})

describe('v9.26: fresh import + beforeunload (render)', () => {
  it('a 25-row import checkpoints mid-run, finishes as done, clears the checkpoint, and warns on beforeunload while importing', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => `Shop ${i + 1},Food,09${100000000 + i},,`)
    const file = csvFile(['name,category,phone_1,township,address_mm', ...rows].join('\n'), 'big.csv')
    const { container } = renderPage()
    await selectFile(container, file, 25)
    fireEvent.click(screen.getByText(/25 လုပ်ငန်း Import လုပ်မည်/))
    // While the loop is in its 500ms inter-chunk pause, leaving warns.
    await waitFor(() => expect(screen.getByText(/Import လုပ်နေသည်/)).toBeTruthy())
    const ev = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    await waitFor(() => expect(screen.getByText(/Import ပြီးပါပြီ/)).toBeTruthy(), { timeout: 8000 })

    expect(mockDB.inserts).toHaveLength(25)
    const lastUpdate = mockDB.bulkUpdates[mockDB.bulkUpdates.length - 1]
    expect(lastUpdate.status).toBe('done')
    expect(lastUpdate.row_success).toBe(25)
    expect(loadBulkImportCheckpoint()).toBeNull()
    expect(longTaskCalls.begin).toBe(1)
    expect(longTaskCalls.end).toBe(1)
  })
})
