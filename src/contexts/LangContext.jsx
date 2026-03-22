import { createContext, useContext, useState, useEffect } from 'react'

const LangContext = createContext(null)

export const T = {
  // Nav
  home: { mm: 'ပင်မ', en: 'Home' },
  news: { mm: 'သတင်း', en: 'News' },
  directory: { mm: 'ရှာဖွေ', en: 'Search' },
  chat: { mm: 'ချတ်', en: 'Chat' },
  profile: { mm: 'ကျွန်တော်', en: 'Me' },
  // Home
  search_btn: { mm: 'ဆိုင်ရှာမယ်', en: 'Find Business' },
  listings_count: { mm: 'ဆိုင်များ', en: 'Listings' },
  news_count: { mm: 'သတင်းများ', en: 'News' },
  free_label: { mm: 'အသုံးပြုရေး', en: 'Usage' },
  categories_title: { mm: 'အမျိုးအစားများ', en: 'Categories' },
  see_all: { mm: 'အားလုံး', en: 'See All' },
  featured_title: { mm: 'Featured ဆိုင်များ', en: 'Featured Listings' },
  news_title: { mm: 'သတင်းနှင့် ဖြစ်ရပ်များ', en: 'News & Events' },
  public_chat: { mm: 'ပြောဆိုရေး', en: 'Public Chat' },
  submit_listing: { mm: 'ဆိုင်ထည့်မယ်', en: 'Add Listing' },
  // Directory
  search_placeholder: { mm: 'ဆိုင်အမည် ရှာရန်...', en: 'Search business...' },
  results_found: { mm: 'ဆိုင် တွေ့ရှိ', en: 'listings found' },
  searching: { mm: 'ရှာဖွေနေသည်...', en: 'Searching...' },
  load_more: { mm: 'ထပ်တင်ရန်', en: 'Load more' },
  remaining: { mm: 'ကျန်', en: 'remaining' },
  no_results: { mm: 'ဆိုင် မတွေ့ပါ', en: 'No listings found' },
  change_filter: { mm: 'ရှာဖွေမှုကို ပြောင်းလဲကြည့်ပါ', en: 'Try changing filters' },
  clear_filter: { mm: 'Filter ဖယ်ရှားရန်', en: 'Clear filters' },
  all_cities: { mm: 'ခပ်သိမ်း', en: 'All cities' },
  // Listing detail
  reviews_title: { mm: 'Reviews', en: 'Reviews' },
  write_review: { mm: 'သင်၏ အကဲဖြတ်ချက်', en: 'Your review' },
  review_placeholder: { mm: 'မှတ်ချက်ရေးရန်... (optional)', en: 'Write a comment... (optional)' },
  submit_review: { mm: 'Review တင်မယ်', en: 'Submit Review' },
  submitting: { mm: 'တင်နေသည်...', en: 'Submitting...' },
  reactions: { mm: 'Reactions', en: 'Reactions' },
  claim_business: { mm: 'ဒါ ကျွန်တော်ဆိုင်', en: 'Claim this Business' },
  claimed: { mm: 'Verified ဆိုင်ရှင်', en: 'Verified Owner' },
  bookmark_save: { mm: 'Save ထားမည်', en: 'Save' },
  bookmark_saved: { mm: 'Save ထားပြီး', en: 'Saved' },
  // News
  all_types: { mm: 'အားလုံး', en: 'All' },
  pinned: { mm: 'Pinned', en: 'Pinned' },
  no_news: { mm: 'သတင်း မတွေ့ပါ', en: 'No news found' },
  // Chat
  message_placeholder_auth: { mm: 'မက်ဆေ့ ရေးရန်...', en: 'Type a message...' },
  message_placeholder_guest: { mm: 'မက်ဆေ့ ရေးရန်... (Guest)', en: 'Type a message... (Guest)' },
  guest_name_title: { mm: 'နာမည် ထည့်ပါ', en: 'Enter your name' },
  guest_name_desc: { mm: 'Chat ပြုလုပ်ရန် Guest နာမည် လိုအပ်သည်', en: 'A guest name is required to chat' },
  guest_placeholder: { mm: 'သင်၏ နာမည်...', en: 'Your name...' },
  change_name: { mm: 'ပြောင်းရန်', en: 'Change' },
  guest_prefix: { mm: 'Guest', en: 'Guest' },
  login_auto: { mm: 'Login လုပ်ပါက နာမည်ကို automatically သုံးမည်', en: 'Login to use your real name automatically' },
  // Login
  login_title: { mm: 'အကောင့် ဝင်ရောက်ရန်', en: 'Sign in to your account' },
  signup_title: { mm: 'အကောင့် အသစ် ဖွင့်ရန်', en: 'Create a new account' },
  name_label: { mm: 'နာမည် (မြန်မာ/English)', en: 'Full Name' },
  name_placeholder: { mm: 'သင်၏ နာမည်...', en: 'Your name...' },
  login_btn: { mm: 'Login ဝင်ရောက်မယ်', en: 'Sign In' },
  signup_btn: { mm: 'အကောင့် ဖွင့်မယ်', en: 'Create Account' },
  logging_in: { mm: 'Logging in...', en: 'Signing in...' },
  creating: { mm: 'Creating...', en: 'Creating...' },
  guest_continue: { mm: 'Guest အဖြစ် ဆက်သွားမယ် →', en: 'Continue as Guest →' },
  guest_notice_1: { mm: 'Login မလုပ်ဘဲ', en: 'Without logging in' },
  guest_notice_2: { mm: 'Directory ကြည့်ရန်၊ News ဖတ်ရန် Login မလိုပါ', en: 'You can browse directory and read news without login' },
  // Submit
  submit_title: { mm: 'ဆိုင် ထည့်မယ်', en: 'Add Listing' },
  logo_label: { mm: 'Logo / ဆိုင်ပုံ', en: 'Logo / Photo' },
  upload_logo: { mm: 'Logo တင်ရန်', en: 'Upload Logo' },
  name_en: { mm: 'ဆိုင်အမည် (English)', en: 'Business Name (English)' },
  name_mm_label: { mm: 'ဆိုင်အမည် (မြန်မာ)', en: 'Business Name (Myanmar)' },
  category_label: { mm: 'အမျိုးအစား', en: 'Category' },
  category_placeholder: { mm: '— ရွေးချယ်ရန် —', en: '— Select category —' },
  desc_label: { mm: 'ဖော်ပြချက် (မြန်မာ)', en: 'Description (Myanmar)' },
  desc_placeholder: { mm: 'ဆိုင်အကြောင်း ဖော်ပြချက်...', en: 'About your business...' },
  city_label: { mm: 'မြို့', en: 'City' },
  ward_label: { mm: 'Ward / ရပ်ကွက်', en: 'Ward / Quarter' },
  ward_placeholder: { mm: 'ရပ်ကွက်...', en: 'Ward name...' },
  address_label: { mm: 'လိပ်စာ (မြန်မာ)', en: 'Address (Myanmar)' },
  address_placeholder: { mm: 'လိပ်စာ...', en: 'Street address...' },
  contact_section: { mm: 'ဆက်သွယ်ရေး', en: 'Contact Info' },
  phone1_label: { mm: 'ဖုန်း (၁)', en: 'Phone 1' },
  phone2_label: { mm: 'ဖုန်း (၂)', en: 'Phone 2' },
  submit_btn: { mm: 'ဆိုင် တင်သွင်းမည်', en: 'Submit Listing' },
  uploading: { mm: 'တင်သွင်းနေသည်...', en: 'Submitting...' },
  submit_notice: { mm: 'Admin မှ စစ်ဆေးပြီးနောက် Directory ထဲ ထည့်သွင်းပေးမည်', en: 'Admin will review and publish your listing' },
  submit_success_title: { mm: 'တင်သွင်းမှု အောင်မြင်ပြီ', en: 'Submission Successful!' },
  submit_success_desc: { mm: 'Admin မှ စစ်ဆေးပြီးနောက် ထုတ်ဖော်မည်ဖြစ်ပါသည်', en: 'Admin will review and publish your listing shortly' },
  go_directory: { mm: 'Directory ကြည့်မည်', en: 'Browse Directory' },
  // Profile
  edit_profile: { mm: 'Profile ပြင်မယ်', en: 'Edit Profile' },
  save: { mm: 'Save', en: 'Save' },
  cancel: { mm: 'Cancel', en: 'Cancel' },
  saving: { mm: 'Saving...', en: 'Saving...' },
  logout: { mm: 'Logout ထွက်မည်', en: 'Sign Out' },
  add_listing: { mm: 'ဆိုင် ထည့်မယ်', en: 'Add Listing' },
  admin_panel: { mm: 'Admin Panel', en: 'Admin Panel' },
  // Misc
  verified: { mm: 'Verified', en: 'Verified' },
  featured: { mm: 'Featured', en: 'Featured' },
  reply: { mm: 'Reply', en: 'Reply' },
  deleted_msg: { mm: 'Message ဖျက်သိမ်းခဲ့သည်', en: 'This message was deleted' },
  loading: { mm: 'Loading...', en: 'Loading...' },
  ok: { mm: 'OK', en: 'OK' },
  // Claim
  claim_title: { mm: 'ဆိုင် Claim လုပ်မည်', en: 'Claim Your Business' },
  claim_desc: { mm: 'ဤဆိုင်သည် သင်၏ ဆိုင်ဖြစ်ကြောင်း Admin ထံ လျှောက်ထားမည်', en: 'Request ownership verification of this listing' },
  claim_phone: { mm: 'Verification ဖုန်းနံပါတ်', en: 'Your contact number for verification' },
  claim_note: { mm: 'Admin မှ စစ်ဆေးပြီး ၁-၂ ရက်အတွင်း အကြောင်းပြန်မည်', en: 'Admin will verify and respond within 1-2 days' },
  claim_submit: { mm: 'Claim လျှောက်မည်', en: 'Submit Claim' },
  claim_sent: { mm: 'Claim လျှောက်ထားပြီ', en: 'Claim Submitted' },
  claim_pending: { mm: 'စစ်ဆေးဆဲ', en: 'Pending Review' },
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('cd_lang') || 'mm')

  function toggleLang() {
    setLang(l => {
      const next = l === 'mm' ? 'en' : 'mm'
      localStorage.setItem('cd_lang', next)
      return next
    })
  }

  function t(key) {
    const entry = T[key]
    if (!entry) return key
    return entry[lang] || entry.mm
  }

  return (
    <LangContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  )
}
