// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../contexts/LangContext'
import { queryClient } from '../lib/queryClient'
import SubmitListingPage from './SubmitListingPage'

// v9.40 — (D) the Submit picker must offer level-3 (and deeper)
// categories, and (Item 1) an on-the-fly category creation must
// invalidate the shared category queries like the Manager does.
//
// NOTE: this file has NO filesystem-path comparisons at all, so the
// 9.19/9.25 backslash-path rule does not apply here — stated
// explicitly per the brief.

const HEALTH_CAT = { id: 'health-id', icon: '🏥', name: 'Health', name_mm: 'ကျန်းမာရေး', type: 'directory', sort_order: 0, parent_id: null, is_active: true }
const HOSP_SUB = { id: 'hospital-id', icon: '🏥', name: 'Hospital', name_mm: 'ဆေးရုံ', type: 'directory', sort_order: 0, parent_id: 'health-id', is_active: true }
const GEN_SUB = { id: 'general-id', icon: '🏥', name: 'General Hospital', name_mm: 'အထွေထွေဆေးရုံ', type: 'directory', sort_order: 0, parent_id: 'hospital-id', is_active: true }
const PRIV_SUB = { id: 'private-id', icon: '🏥', name: 'Private Hospital', name_mm: 'ပုဂ္ဂလိကဆေးရုံ', type: 'directory', sort_order: 0, parent_id: 'hospital-id', is_active: true }

const { mockDB, mockAuth } = vi.hoisted(() => ({
  mockDB: { cats: [], inserted: null, newId: 0 },
  mockAuth: { profile: { id: 'user-1' }, isLoggedIn: true, isAdmin: false, isModerator: false },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table) {
      const state = { table, payload: null, op: null, single: false }
      const b = {
        select() { return b },
        eq() { return b },
        order() { return b },
        or() { return b },
        limit() { return b },
        insert(payload) {
          state.op = 'insert'
          state.payload = payload
          return b
        },
        single() { state.single = true; return b },
        then(resolve) {
          // Mutation applies here: .select().single() follow insert()
          // in the quick-add chain, so the payload is only final now.
          if (state.op === 'insert') {
            if (state.table === 'categories') {
              const row = { id: `cat-new-${++mockDB.newId}`, ...state.payload }
              mockDB.cats.push(row)
              resolve({ data: row, error: null })
            } else if (state.table === 'listings') {
              mockDB.inserted = { ...state.payload }
              resolve({ error: null })
            } else {
              resolve({ error: null })
            }
            return
          }
          if (state.table === 'categories') resolve({ data: [...mockDB.cats], error: null })
          else if (state.table === 'listings') resolve({ data: [], error: null })
          else resolve({ data: [], error: null })
        },
      }
      return b
    },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ cities: ['Taunggyi', 'Kalaw'] }),
}))

vi.mock('../lib/toast', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

// Leaflet cannot mount in jsdom — the map is irrelevant to the picker.
vi.mock('../components/LocationPicker', () => ({
  default: () => null,
}))

function renderSubmit() {
  return render(
    <MemoryRouter initialEntries={['/submit']}>
      <LangProvider>
        <SubmitListingPage />
      </LangProvider>
    </MemoryRouter>
  )
}

function categorySelect(container) {
  return [...container.querySelectorAll('select')].find(s =>
    [...s.options].some(o => o.textContent.includes('ကျန်းမာရေး')))
}

beforeEach(() => {
  cleanup()
  mockDB.cats = [{ ...HEALTH_CAT }, { ...HOSP_SUB }, { ...GEN_SUB }, { ...PRIV_SUB }]
  mockDB.inserted = null
  mockDB.newId = 0
  mockAuth.profile = { id: 'user-1' }
  mockAuth.isLoggedIn = true
  mockAuth.isAdmin = false
  mockAuth.isModerator = false
  queryClient.clear()
  window.localStorage.clear()
})

afterEach(() => { cleanup() })

describe('v9.40 (D) SUBMIT PICKER — a level-3 category is pickable and submittable', () => {
  it('General Hospital (level 3) appears in the picker, is selectable, and the form submits with its id', async () => {
    const { container } = renderSubmit()

    // Wait for the categories to load into the picker.
    await waitFor(() => expect(categorySelect(container)).toBeTruthy(), { timeout: 5000 })
    const select = categorySelect(container)
    const optionTexts = [...select.options].map(o => o.textContent)
    // On 9.39 the picker renders only top-level optgroups + direct
    // subs, so no level-3 option exists and this fails.
    expect(optionTexts.some(t => t.includes('အထွေထွေဆေးရုံ'))).toBe(true)
    expect(optionTexts.some(t => t.includes('ပုဂ္ဂလိကဆေးရုံ'))).toBe(true)
    // The intermediate parent stays selectable via its own option
    // (SB7/E9: a listing can be filed directly under a parent, not
    // only under its subs — the '(အားလုံး)' alias is the top-level
    // parent's option, the sub's own option carries its id).
    const hospOption = [...select.options].find(o => o.textContent.includes('ဆေးရုံ') && !o.textContent.includes('အားလုံး'))
    expect(hospOption).toBeTruthy()
    expect(hospOption.value).toBe('hospital-id')
    expect(optionTexts.some(t => t.includes('ကျန်းမာရေး') && t.includes('အားလုံး'))).toBe(true)
    fireEvent.change(select, { target: { value: 'general-id' } })
    expect(select.value).toBe('general-id')

    fireEvent.change(screen.getByPlaceholderText('လုပ်ငန်း / ဝန်ဆောင်မှု အမည်...'), { target: { value: 'Test General Hospital' } })
    fireEvent.click(screen.getByText('သိမ်းမည်'))

    await waitFor(() => expect(mockDB.inserted).not.toBeNull(), { timeout: 5000 })
    expect(mockDB.inserted.category_id).toBe('general-id')
    expect(mockDB.inserted.name_mm).toBe('Test General Hospital')
  }, 20000)

  it('on-the-fly category creation invalidates the shared category queries', async () => {
    mockAuth.isAdmin = true
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    try {
      const { container } = renderSubmit()
      await waitFor(() => expect(categorySelect(container)).toBeTruthy(), { timeout: 5000 })

      // Open the quick-add modal (+ button beside the picker).
      fireEvent.click(screen.getByTitle('Category အသစ်ထည့်မည်'))
      fireEvent.change(
        screen.getByPlaceholderText('ဥပမာ: Freelance, အဝတ်လျှော်, Construction'),
        { target: { value: 'စမ်းသပ်အမျိုးအစား' } },
      )
      // The modal header's save button.
      fireEvent.click(screen.getByText('ထည့်မည်'))

      // On 9.39 the quick-add only refetches its own list — the
      // shared queries are never invalidated, so this times out.
      await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 5000 })
      for (const key of [['categories'], ['home', 'categories'], ['category-map'], ['category-tree']]) {
        expect(spy).toHaveBeenCalledWith({ queryKey: key })
      }
      // The new category becomes the selected one.
      await waitFor(() => expect(categorySelect(container)?.value).toBe('cat-new-1'), { timeout: 5000 })
    } finally {
      spy.mockRestore()
    }
  }, 20000)
})
