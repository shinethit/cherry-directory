// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AboutPage, PrivacyPage, TermsPage, HelpPage } from './InfoPages'

// v9.41 — About / Privacy / Terms rewritten from the approved draft
// (full plain-language rewrite), Help 10 fixes + push corrections,
// Calendar RSVP buttons in Burmese, Profile toggle in Burmese,
// Market Price auto-delete note removed.
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons on file paths) — the
// only node:path use is locating version-changes.json / Header.jsx /
// package.json / usePWA.js for static assertions, read with
// readFileSync, never compared as paths — so the 9.19/9.25
// backslash-path rule does not apply here.

vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ app_name: 'Cherry Directory', app_city: 'တောင်ကြီးမြို့' }),
}))

function renderPage(ui) {
  return render(<MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>)
}

beforeEach(() => { cleanup() })
afterEach(() => { cleanup() })

describe('v9.41 (A) ABOUT — draft rewrite', () => {
  it('how-to-use says စာရင်းပေးနိုင်ပါသည် with ပြက္ခဒိန်, and no RSVP anywhere on the page', () => {
    renderPage(<AboutPage />)
    expect(screen.getByText(/ပါဝင်မည်ဆိုတာ စာရင်းပေးနိုင်ပါသည်/)).toBeTruthy()
    expect(screen.getByText(/ပြက္ခဒိန်တွင် ရပ်ရွာပွဲများကို ကြည့်ရှုပြီး/)).toBeTruthy()
    // Mission sentence (draft wording) + owners badge + contributors rank.
    expect(screen.getByText(/ရပ်ရွာ စိတ်ဓာတ် ခိုင်မာရေးတို့အတွက် ဖြစ်ပါသည်/)).toBeTruthy()
    expect(screen.getByText(/အတည်ပြု တံဆိပ် ပေးအပ်ပါသည်/)).toBeTruthy()
    expect(screen.getByText(/အမှတ်စာရင်းတွင် အဆင့် တက်နိုင်ပါသည်/)).toBeTruthy()
    // Typo fixed: ဆင်နွှဲခြင်း (was ဆင်နှဲခြင်း).
    expect(document.body.textContent).not.toContain('ဆင်နှဲခြင်း')
    expect(document.body.textContent).not.toContain('RSVP')
    expect(document.body.textContent).not.toContain('Top Contributor Badge')
    // Top card unchanged: logo city, version, byline.
    expect(screen.getByText(/Version 9.42 • Since 2026/)).toBeTruthy()
    expect(screen.getByText('by Shine Thit')).toBeTruthy()
  })
})

describe('v9.41 (A) PRIVACY — draft rewrite', () => {
  it('collected list has GPS-as-map-place + last-seen + visits; no delete claim, no auto-delete, no brand names, no GPS', () => {
    renderPage(<PrivacyPage />)
    expect(screen.getByText(/တည်နေရာ \(မြေပုံပေါ်က နေရာ — ထည့်ချင်မှ ထည့်ပါ\)/)).toBeTruthy()
    expect(screen.getByText(/App သုံးနေချိန် နောက်ဆုံး ဖွင့်ခဲ့သော အချိန် \(အွန်လိုင်း ရှိ\/မရှိ ပြရန်\)/)).toBeTruthy()
    expect(screen.getByText(/လာရောက်ကြည့်ရှုမှု \(တစ်ခါ ရောက်တိုင်း တစ်ကြိမ်/)).toBeTruthy()
    // Draft-kept on purpose: the collected list still names
    // Leaderboard here — do NOT "fix" it away (see brief NOTE).
    expect(screen.getByText(/Review၊ သိမ်းဆည်းထားသော လုပ်ငန်း၊ အမှတ်နှင့် Leaderboard အချက်အလက်/)).toBeTruthy()
    // Rights: edit only, account deletion via Admin — no self-delete.
    expect(screen.getByText(/သင်သည် မိမိ Profile ကို ကိုယ်တိုင် Edit လုပ်နိုင်ပါသည်။ Account ဖျက်ချင်ပါက Admin ကို ဆက်သွယ်နိုင်ပါသည်။/)).toBeTruthy()
    // Third-party: plain country-only sentence, no brand names.
    expect(screen.getByText(/Personal Data ကို မည်သူ့ကိုမှ မရောင်းပါ \/ မမျှဝေပါ/)).toBeTruthy()
    expect(screen.getByText(/ဘယ် နိုင်ငံက လာကြည့်လဲ ဆိုတာသာ မှတ်ပါသည်/)).toBeTruthy()
    const body = document.body.textContent
    expect(body).not.toContain('Delete လုပ်နိုင်ပါသည်')
    expect(body).not.toContain('auto-delete')
    expect(body).not.toContain('Supabase')
    expect(body).not.toContain('Cloudinary')
    expect(body).not.toContain('ipwho.is')
    expect(body).not.toContain('GPS')
    // Disclaimer banner: new body, ⚡ divider line deleted.
    expect(screen.getByText(/ဖုန်းနံပါတ်နှင့် လိပ်စာများကို ကိုယ်တိုင် စစ်ဆေးပြီးမှ ဆက်သွယ်ပါ/)).toBeTruthy()
    expect(body).not.toContain('တိကျမှုကို အာမခံနိုင်မည် မဟုတ်ပါ')
  })
})

describe('v9.41 (A) TERMS — draft rewrite', () => {
  it('ownership stays with the user, plain prohibitions, no ဆက်ဆံပါသည် / တည်းဖြတ်', () => {
    renderPage(<TermsPage />)
    expect(screen.getByText(/ပိုင်ဆိုင်မှုသည် သင်၌သာ ရှိပါသည်/)).toBeTruthy()
    expect(screen.getByText(/App တွင် ပြသခွင့်သာ ရရှိပါသည်/)).toBeTruthy()
    expect(screen.getByText(/ကိုယ်တိုင် စစ်ဆေးပြီးမှ သုံးရန်/)).toBeTruthy()
    expect(screen.getByText(/စီမံခန့်ခွဲသူ/)).toBeTruthy()
    expect(screen.getByText(/တာဝန်မယူပါ/)).toBeTruthy()
    // Draft-kept on purpose: the Community Data opening still says
    // "ဈေးနှုန်း Report များ" — do NOT "fix" it away (see brief NOTE).
    expect(screen.getByText(/ဈေးနှုန်း Report များသည် Community မှ တင်ပြသော အချက်အလက်များ ဖြစ်ပြီး/)).toBeTruthy()
    const body = document.body.textContent
    expect(body).not.toContain('ဆက်ဆံပါသည်')
    expect(body).not.toContain('တည်းဖြတ်')
    expect(body).not.toContain('တာဝန်မယူနိုင်ပါ')
  })
})

describe('v9.41 (A) HELP — all 10 draft fixes + push corrections', () => {
  it('button names match the real buttons; push is NOT promised anywhere', () => {
    renderPage(<HelpPage />)
    expect(screen.getAllByText(/"တင်သွင်းမည်" ကို နှိပ်ပါ/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/"ဤလုပ်ငန်းကို တိုင်ကြားမည်" ကို နှိပ်/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/"ပါဝင်မည်" သို့မဟုတ် "စိတ်ဝင်စားသည်" ကို နှိပ်ပါ/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/"ပိုင်ဆိုင်ကြောင်း တောင်းဆိုမည်" ကို နှိပ်/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/"ပြက္ခဒိန်" icon/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/ပွဲတက်ရန် စာရင်းပေးပါ \(\+2 အမှတ်\)/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/"Verified" filter/).length).toBeGreaterThanOrEqual(1)
    // Correction 1: account benefits list — no Push Notification, and
    // plain-language Leaderboard / RSVP replacements in the same line.
    expect(screen.getByText(/အမှတ် \+ အမှတ်စာရင်း၊ ပွဲတက်ရန် စာရင်းပေးခြင်း/)).toBeTruthy()
    // Correction 1: the PWA push line promises nothing — notifications
    // do not work yet (usePWA enablePush is an honest stub).
    expect(screen.getByText(/အသိပေးချက် မရသေးပါ — နောက်ထပ် version တွင် ရနိုင်မည်/)).toBeTruthy()
    const body = document.body.textContent
    expect(body).not.toContain('Push Notification')
    expect(body).not.toContain('Event RSVP')
    expect(body).not.toContain('RSVP')
    expect(body).not.toContain('(PWA)')
    expect(body).not.toContain('Verified Owner')
    expect(body).not.toContain('ဒါ ကျွန်တော်ဆိုင်')
  })
})

// v9.41 (F) CHANGELOG — the 9.41 entry in version-changes.json matches
// the Header.jsx history entry (Burmese), zero Admin. Follows the 9.40
// (F3) pattern; the current-version pins moved here from
// DirectoryPage940.test.jsx.
// v9.42 ROLL-FORWARD: the current-version pins that used to live
// here (pkg.version, the modal lead date, LEAD_FALLBACK_MY_941)
// now live in Fixes942.test.jsx (F) for 9.42 — this block
// keeps only the 9.41-entry match, like the 9.40 (F3) block.
const CHANGES_MY_941 = [
  'About / Privacy / Terms စာသားများကို အစအဆုံး ပြန်ရေးပြီး သာမန်လူ နားလည်လွယ်အောင် ပြင်ထားသည်',
  'RSVP၊ Tier၊ Leaderboard၊ GPS စသော အင်္ဂလိပ် အသုံးများကို မြန်မာလို ပြောင်းထားသည်',
  'ပြက္ခဒိန် ပွဲတက်ရန် ခလုတ်များ "ပါဝင်မည်" / "စိတ်ဝင်စားသည်" မြန်မာလို ဖြစ်သွားပြီ',
  'Profile က အသိပေးချက် toggle မြန်မာလို ("အသိပေးချက်များ") ဖြစ်သွားပြီ',
  'ဈေးနှုန်း စာမျက်နှာက ၆ လ auto-delete ဆိုတဲ့ စာသားကို ဖြုတ်ထားသည်',
  'စာမျက်နှာကို တိုက်ရိုက်ဖွင့်ပြီး Back နှိပ်ရင် App အပြင်ကို ထွက်မသွားတော့ဘဲ ပင်မစာမျက်နှာကို ပြန်သွားမည်',
  'လုပ်ငန်းတင်သွင်းတဲ့ ဖောင်မှာ အင်္ဂလိပ် သတိပေးချက် မပေါ်တော့ပါ',
]
const CHANGES_EN_941 = [
  'About, Privacy and Terms rewritten from scratch in plain language anyone can understand',
  'English jargon (RSVP, Tier, Leaderboard, GPS…) replaced with Burmese',
  'Calendar event buttons are now in Burmese (Going / Interested)',
  'Profile notifications toggle is now in Burmese',
  'Removed the 6-month auto-delete note from the Market Price page',
  'Back button on a directly opened page now goes Home instead of leaving the app',
  'Submit form no longer shows an English browser message',
]

describe('v9.41 (F) CHANGELOG — 9.41 entry, Header match, zero Admin', () => {
  it('(F) version-changes.json 9.41 entry matches the Header.jsx 9.41 entry, zero Admin', () => {
    const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const changes = JSON.parse(readFileSync(join(rootDir, 'version-changes.json'), 'utf8'))
    expect(changes['9.41']).toBeTruthy()
    expect(changes['9.41'].changesMy).toEqual(CHANGES_MY_941)
    expect(changes['9.41'].changesEn).toEqual(CHANGES_EN_941)
    const header = readFileSync(join(rootDir, 'src', 'components', 'Header.jsx'), 'utf8')
    expect(header).toContain("{ v: '9.41', date: '2026-11-14'")
    for (const item of CHANGES_MY_941) {
      expect(header).toContain(item)
    }
    const entry = header.slice(header.indexOf("{ v: '9.41'"), header.indexOf("{ v: '9.40'"))
    expect(entry).not.toMatch(/Admin/i)
    expect(JSON.stringify(changes['9.41'])).not.toMatch(/Admin/i)
  })

  it('(F) usePWA enablePush toast is plain Burmese and promises nothing', () => {
    const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const src = readFileSync(join(rootDir, 'src', 'hooks', 'usePWA.js'), 'utf8')
    expect(src).toContain('အသိပေးချက် မရသေးပါ — နောက်ထပ် version တွင် ရနိုင်မည်')
    expect(src).not.toContain('Push notification မရသေးပါ')
  })
})
