// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HelpPage } from './InfoPages'

// v9.42 — remaining English terms (RSVP, GPS, Leaderboard, Tier,
// Report…) in Myanmar mode replaced with plain Burmese, event
// buttons/status labels unified (ပါဝင်မည် / စိတ်ဝင်စားသည်), the
// not-yet-available notifications item removed from the Home
// benefits list.
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons on file paths) —
// the only node:path use is locating source files /
// version-changes.json / Header.jsx / package.json for static
// assertions, read with readFileSync, never compared as paths — so
// the 9.19/9.25 backslash-path rule does not apply here.

vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ app_name: 'Cherry Directory', app_city: 'တောင်ကြီးမြို့' }),
}))

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const rootDir = join(srcDir, '..')
const src = (rel) => readFileSync(join(srcDir, rel), 'utf8')

function renderPage(ui) {
  return render(<MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>)
}

beforeEach(() => { cleanup() })
afterEach(() => { cleanup() })

describe('v9.42 (A) POST DETAIL — RSVP buttons unified, login gates in Burmese', () => {
  it('buttons are ပါဝင်မည် / စိတ်ဝင်စားသည် and the login gates say စာရင်းပေး', () => {
    const post = src('pages/PostDetailPage.jsx')
    expect(post).toContain('ပါဝင်မည် {counts.going')
    expect(post).toContain('စိတ်ဝင်စားသည် {counts.interested')
    expect(post).toContain('အကောင့်ဝင်မှ စာရင်းပေးနိုင်မည်')
    expect(post).toContain('စာရင်းပေးရန် Login လိုအပ်သည်')
    expect(post).not.toContain('RSVP လုပ်နိုင်မည်')
    expect(post).not.toContain('RSVP လုပ်ရန်')
    expect(post).not.toContain('သွားမည် {counts.going')
    expect(post).not.toContain('ဖြစ်နိုင်သည် {counts.interested')
    // Timeout label is not user-visible — unchanged.
    expect(post).toContain("'RSVP counts'")
  })
})

describe('v9.42 (B) MY RSVPS — title and every mm string in Burmese', () => {
  it('mm title is စာရင်းပေးထားသော ပွဲများ; statuses unify with Calendar; no RSVP in mm strings', () => {
    const my = src('pages/MyRsvpsPage.jsx')
    expect(my).toContain("useSEO({ title: lang === 'mm' ? 'စာရင်းပေးထားသော ပွဲများ' : 'My RSVPs' })")
    expect(my).toContain("🎟️ {lang === 'mm' ? 'စာရင်းပေးထားသော ပွဲများ' : 'My RSVPs'}")
    expect(my).toContain("mm: 'ပါဝင်မည်'")
    expect(my).toContain("mm: 'စိတ်ဝင်စားသည်'")
    expect(my).toContain('စာရင်းပေးထားတာ ပယ်ဖျက်မှာ သေချာလား?')
    expect(my).toContain('စာရင်းပေးထားတာ ပယ်ဖျက်မရပါ — ထပ်ကြိုးစားပါ')
    expect(my).toContain('စာရင်းပေးထားတာ ပယ်ဖျက်ပြီးပါပြီ')
    expect(my).toContain('စာရင်းပေးထားတဲ့ ပွဲတွေ ကြည့်ရန် Login ဝင်ပါ')
    expect(my).toContain('စာရင်းပေးထားတဲ့ ပွဲတွေ ရယူမရပါ')
    expect(my).toContain('လာမည့် စာရင်းပေးထားသော ပွဲ မရှိ')
    expect(my).toContain('စာရင်းပေးထားတဲ့ မှတ်တမ်း မရှိ')
    expect(my).toContain('Calendar မှ ပွဲတွေ စာရင်းပေးပါ')
    expect(my).toContain('စာရင်းပေးထားတာ ပယ်ဖျက်')
    expect(my).not.toContain('တက်မည့် ဖြစ်ရပ်များ')
    expect(my).not.toContain("mm: 'တက်မည်'")
    expect(my).not.toContain("mm: 'စိတ်ဝင်စား',")
    expect(my).not.toContain('RSVP ပယ်ဖျက်')
    expect(my).not.toContain('RSVP များ')
    expect(my).not.toContain('လာမည့် RSVP')
    expect(my).not.toContain('RSVP မှတ်တမ်း')
    expect(my).not.toContain('RSVP လုပ်ပါ')
    // English mode stays English.
    expect(my).toContain("en: 'Going'")
    expect(my).toContain("en: 'Interested'")
    expect(my).toContain("'Cancel RSVP?'")
  })
})

describe('v9.42 (C) HOME — benefits box has no Push Notification / Event RSVP', () => {
  it('Leaderboard → အမှတ်စာရင်း, Event RSVP → ပွဲတက်ရန် စာရင်းပေးခြင်း, Push Notification line gone', () => {
    const home = src('pages/HomePage.jsx')
    expect(home).toContain('အမှတ် + အမှတ်စာရင်း')
    expect(home).toContain('ပွဲတက်ရန် စာရင်းပေးခြင်း')
    expect(home).not.toContain('Push Notification')
    expect(home).not.toContain('Event RSVP')
    expect(home).not.toContain('အမှတ် + Leaderboard')
  })
})

describe('v9.42 (D) HELP — Report → တိုင်ကြား, Leaderboard/Rank → အမှတ်စာရင်း/အဆင့်', () => {
  it('step 4 says တိုင်ကြားခြင်းသာ and the points step says အမှတ်စာရင်း / အဆင့်', () => {
    renderPage(<HelpPage />)
    expect(screen.getByText(/တခြားသူ့ဆိုင်ကို တိုက်ရိုက် ပြင်လို့မရပါ — တိုင်ကြားခြင်းသာ လုပ်နိုင်သည်/)).toBeTruthy()
    expect(screen.getByText(/အမှတ်စာရင်းတွင် ကိုယ့် အဆင့် ကြည့်နိုင်သည်/)).toBeTruthy()
    const body = document.body.textContent
    expect(body).not.toContain('Report ပဲ လုပ်နိုင်သည်')
    expect(body).not.toContain("Leaderboard တွင် ကိုယ့် Rank")
  })
})

describe('v9.42 (E) PROFILE — stat label and menu row in Burmese', () => {
  it('stat label is ပွဲစာရင်း, menu row is စာရင်းပေးထားသော ပွဲများ, back link is အမှတ်စာရင်း', () => {
    const profile = src('pages/ProfilePage.jsx')
    expect(profile).toContain("label: lang === 'mm' ? 'ပွဲစာရင်း'")
    expect(profile).toContain("labelMm: 'စာရင်းပေးထားသော ပွဲများ'")
    expect(profile).toContain('အမှတ်စာရင်း သို့ ပြန်မည်')
    expect(profile).not.toContain("label: lang === 'mm' ? 'RSVP'")
    expect(profile).not.toContain("labelMm: 'တက်မည့် ဖြစ်ရပ်များ'")
    expect(profile).not.toContain('Leaderboard သို့ ပြန်မည်')
    // English mode stays English.
    expect(profile).toContain("label: 'My RSVPs'")
    expect(profile).toContain("label: lang === 'mm' ? 'ပွဲစာရင်း' : 'RSVPs'")
  })
})

describe('v9.42 (F) GPS → မြေပုံပေါ်က နေရာ in both listing forms', () => {
  it('Submit form mm strings use မြေပုံပေါ်က နေရာ, no GPS in mm strings', () => {
    const submit = src('pages/SubmitListingPage.jsx')
    expect(submit).toContain('မြေပုံပေါ်က နေရာ ရှာမရပါ — မြေပုံပေါ်မှာ ရွေးပေးပါ')
    expect(submit).toContain('လိပ်စာ၊ မြို့၊ မြေပုံပေါ်က နေရာ')
    expect(submit).toContain('မြေပုံပေါ်က နေရာ ရယူမည်')
    expect(submit).not.toContain('GPS ရှာမရပါ')
    expect(submit).not.toContain('GPS ရယူမည်')
    expect(submit).not.toContain('မြို့၊ GPS')
    // English mode stays English.
    expect(submit).toContain('GPS is not available')
    expect(submit).toContain("'Use GPS'")
  })

  it('Edit form mm strings use မြေပုံပေါ်က နေရာ, no GPS in mm strings', () => {
    const edit = src('pages/EditListingPage.jsx')
    expect(edit).toContain('မြေပုံပေါ်က နေရာ ရှာမရပါ — မြေပုံပေါ်မှာ ရွေးပေးပါ')
    expect(edit).toContain('မြေပုံပေါ်က နေရာ ရယူမည်')
    expect(edit).toContain('တည်နေရာ မသတ်မှတ်ရသေးပါ — မြေပုံပေါ်က နေရာ သို့မဟုတ် မြေပုံမှ ရွေးပါ')
    expect(edit).not.toContain('GPS')
  })
})

describe('v9.42 (G) FINAL SWEEP — remaining pages', () => {
  it('Onboarding, Leaderboard page, Points Guide: Leaderboard/Tier → အမှတ်စာရင်း/အဆင့်', () => {
    const guide = src('components/OnboardingGuide.jsx')
    expect(guide).toContain('အမှတ်စာရင်း မှာ ပါဝင်ပါ')
    expect(guide).not.toContain('Leaderboard မှာ ပါဝင်ပါ')
    const board = src('pages/LeaderboardPage.jsx')
    expect(board).toContain('အမှတ်စာရင်း ရယူမရပါ')
    expect(board).toContain('အမြင့်ဆုံး အဆင့် ရောက်ပြီ')
    expect(board).not.toContain('Leaderboard ရယူမရပါ')
    expect(board).not.toContain('အမြင့်ဆုံး Tier')
    const points = src('pages/PointsGuidePage.jsx')
    expect(points).toContain('လက်ရှိ အဆင့်')
    expect(points).toContain('အမြင့်ဆုံး အဆင့်')
    expect(points).toContain("'အဆင့်များ'")
    expect(points).toContain('အမှတ်စာရင်း ကြည့်မည်')
    expect(points).not.toContain('လက်ရှိ Tier')
    expect(points).not.toContain('အမြင့်ဆုံး Tier')
    expect(points).not.toContain('Tier အဆင့်များ')
    expect(points).not.toContain('Leaderboard ကြည့်မည်')
    // English mode stays English (deliberately kept in 9.41).
    expect(points).toContain("en: 'RSVP'")
    expect(points).toContain("'Tier Levels'")
  })

  it('Community / bus: Report → တင်ပြချက် (a submitted report, not a complaint)', () => {
    const community = src('pages/CommunityPage.jsx')
    expect(community).toContain('ကား ထွက်ချိန် တင်ပြချက်များ')
    expect(community).not.toContain('ကား ထွက်ချိန် Report')
    const bus = src('pages/CommunityFeaturePages.jsx')
    expect(bus).toContain('ကားထွက်ချိန် တင်ပြချက်များ')
    expect(bus).not.toContain('Community Report')
    expect(bus).toContain("'Report a Departure'")
  })

  it('Market Price: Report → တင်ပြချက် (a submitted price, not a complaint)', () => {
    const prices = src('pages/MarketPricePage.jsx')
    expect(prices).toContain('ဈေးနှုန်း တင်ပြရာမှာ ပေါ်မည့် ဈေးကွက်များ')
    expect(prices).toContain('တင်ပြချက် (48h)')
    expect(prices).toContain('နောက်ဆုံး တင်ပြချက်များ')
    expect(prices).toContain('ဒီ တင်ပြချက်ကို ဖျက်မည်လား?')
    expect(prices).toContain('တင်ပြချက် ဖျက်မည်')
    expect(prices).not.toContain('ဈေးနှုန်း Report မှာ')
    expect(prices).not.toContain('Report (48h)')
    expect(prices).not.toContain('နောက်ဆုံး Report များ')
    expect(prices).not.toContain('ဒီ Report ကို')
    expect(prices).not.toContain('Report ဖျက်မည်')
  })

  it('Lost & Found report flow speaks တိုင်ကြား like the listing flow (9.41)', () => {
    const lost = src('pages/LostFoundDetailPage.jsx')
    expect(lost).toContain('ဤ Post ကို ၂၄ နာရီအတွင်း တိုင်ကြားပြီးဖြစ်သည်')
    expect(lost).toContain('တိုင်ကြားမရပါ')
    expect(lost).toContain('တိုင်ကြားပြီးပါပြီ — Admin မှ စစ်ဆေးမည်')
    expect(lost).toContain('တိုင်ကြားမည်')
    expect(lost).toContain('တိုင်ကြားရသည့် အကြောင်းရင်း...')
    expect(lost).not.toContain('Report တင်ပြီးဖြစ်သည်')
    expect(lost).not.toContain('Report တင်မရပါ')
    expect(lost).not.toContain('Report တင်ပြီးပါပြီ')
    expect(lost).not.toContain('Report လုပ်မည်')
    expect(lost).not.toContain('Report လုပ်ရသည့်')
    expect(lost).not.toContain('Report တင်မည်')
    expect(lost).toContain("'Report this post'")
  })

  it('Admin Reports page: Report → တိုင်ကြားချက် in mm strings', () => {
    const admin = src('pages/AdminReportsPage.jsx')
    expect(admin).toContain('တိုင်ကြားချက်များ ရယူမရပါ')
    expect(admin).toContain('ဤ တိုင်ကြားချက်ကို ဖြေရှင်းပြီး သတ်မှတ်မည်လား?')
    expect(admin).toContain('ဤ တိုင်ကြားချက်ကို ပယ်ချမည်လား?')
    expect(admin).toContain('တိုင်ကြားချက် အပ်ဒိတ်လုပ်ရာတွင် အမှားရှိသည်')
    expect(admin).toContain('ဤ တိုင်ကြားချက်ကို အခြား Admin မှ ဆုံးဖြတ်ပြီးဖြစ်သည်')
    expect(admin).toContain('တိုင်ကြားချက်ကို မဖြေရှင်းရသေးပါ')
    expect(admin).toContain('တိုင်ကြားချက် ပယ်ချပြီးပါပြီ')
    expect(admin).toContain('တိုင်ကြားချက်များ ရယူရာတွင် အမှားဖြစ်သွားသည်')
    expect(admin).toContain('တိုင်ကြားချက် မရှိပါ')
    expect(admin).not.toContain('Report များ')
    expect(admin).not.toContain('ဤ Report ကို')
    expect(admin).not.toContain('Report အပ်ဒိတ်')
    expect(admin).not.toContain('Report ပယ်ချပြီးပါပြီ')
    expect(admin).not.toContain('Report မရှိပါ')
    expect(admin).toContain("'Reports'")
  })

  it('draft-kept words from 9.41 are still there (do NOT fix away)', () => {
    const info = src('pages/InfoPages.jsx')
    expect(info).toContain('Leaderboard အချက်အလက်')
    expect(info).toContain('ဈေးနှုန်း Report များ')
  })
})

// v9.42 (F) CHANGELOG — the 9.42 entry in version-changes.json matches
// the Header.jsx history entry (Burmese), zero Admin, and the offline
// fallback leads with the same items. Follows the 9.41 (F) pattern;
// the current-version pins moved here from InfoPages941.test.jsx.
const CHANGES_MY_942 = [
  'RSVP၊ GPS စသော ကျန်နေတဲ့ အင်္ဂလိပ် အသုံးတွေကို မြန်မာလို ထပ်ပြောင်းထားသည်',
  'ပွဲတက်ရန် ခလုတ်နဲ့ အခြေအနေ စာသားတွေ အားလုံး တစ်ပုံစံတည်း ဖြစ်သွားပြီ (ပါဝင်မည် / စိတ်ဝင်စားသည်)',
  '"My RSVPs" စာမျက်နှာနဲ့ Profile က စာရင်းတွေ မြန်မာလို ဖြစ်သွားပြီ',
  'Home က အကျိုးခံစားခွင့် စာရင်းက အသိပေးချက် (မရသေးတာ) ကို ဖြုတ်ထားသည်',
  'Help စာထဲက ကျန်နေတဲ့ "Report" စာသားကိုလည်း "တိုင်ကြား" လို့ ပြင်ထားသည်',
]
const CHANGES_EN_942 = [
  'Remaining English terms (RSVP, GPS…) replaced with Burmese',
  'Event buttons and status labels are now consistent everywhere',
  '"My RSVPs" page and Profile labels are now in Burmese',
  'Removed the not-yet-available notifications item from the Home benefits list',
  "Fixed a remaining 'Report' wording in Help",
]

describe('v9.42 (F) CHANGELOG — 9.42 entry, Header match, zero Admin', () => {
  it('(F) version-changes.json 9.42 entry matches the Header.jsx 9.42 entry, zero Admin', () => {
    const changes = JSON.parse(readFileSync(join(rootDir, 'version-changes.json'), 'utf8'))
    expect(changes['9.42']).toBeTruthy()
    expect(changes['9.42'].changesMy).toEqual(CHANGES_MY_942)
    expect(changes['9.42'].changesEn).toEqual(CHANGES_EN_942)
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.42')
    const header = readFileSync(join(srcDir, 'components', 'Header.jsx'), 'utf8')
    expect(header).toContain("{ v: '9.42', date: '2026-11-14'")
    for (const item of CHANGES_MY_942) {
      expect(header).toContain(item)
    }
    const entry = header.slice(header.indexOf("{ v: '9.42'"), header.indexOf("{ v: '9.41'"))
    expect(entry).not.toMatch(/Admin/i)
    expect(JSON.stringify(changes['9.42'])).not.toMatch(/Admin/i)
    // The modal's lead block (v{APP_VERSION} badge) must carry the
    // CURRENT version's date, not the previous version's.
    const lead = header.slice(header.indexOf('v{APP_VERSION}'), header.indexOf("{ v: '9.42'"))
    expect(lead).toContain('2026-11-14')
    // The offline fallback constant carries the same 9.42 items.
    expect(header).toContain('LEAD_FALLBACK_MY_942')
    const fallback = header.slice(header.indexOf('LEAD_FALLBACK_MY_942 = ['), header.indexOf('LEAD_FALLBACK_MY_942 = [') + 2000)
    for (const item of CHANGES_MY_942) {
      expect(fallback).toContain(item)
    }
  })
})
