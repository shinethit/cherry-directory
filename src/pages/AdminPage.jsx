import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Check, X, Eye, Pencil, Trash2, AlertCircle, Save, 
  LayoutDashboard, List, FolderTree, Users, Link as LinkIcon, 
  UserCog, Search, RefreshCw, TrendingUp, FileText, Star,
  EyeOff, Calendar, Megaphone, Shield, BadgeCheck, Lock, Database, Download
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import CategoryManagerPage from './CategoryManagerPage'
import { confirmDialog } from '../lib/confirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { useAuditLog } from '../hooks/useAuditLog'
import { showError, showSuccess } from '../lib/toast'
import { yangonToday, formatMyanmarDate } from '../lib/myanmarDate'
import { toCSV } from '../lib/csv'
import { formatPeakHour, devicePercentages } from '../lib/visitTracking'
import { validatePhone, validateUrl } from '../lib/validation'

const PRESET_LINKS = [
  { url: '', label: '-- App ထဲရှိ စာမျက်နှာတစ်ခုကို ရွေးပါ --' },
  { url: '/prices', label: '🛒 ဈေးနှုန်းဘုတ် (Market Prices)', icon: '🛒', title: 'Market Prices', title_mm: 'ဈေးနှုန်းဘုတ်', subtitle: 'Market Prices', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: '/chat', label: '💬 Public Chat (ပြောဆိုရေး)', icon: '💬', title: 'Public Chat', title_mm: 'Public Chat', subtitle: 'ပြောဆိုရေး', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: '/submit', label: '➕ လုပ်ငန်းထည့်မည် (Submit Listing)', icon: '➕', title: 'Submit Listing', title_mm: 'လုပ်ငန်းထည့်မည်', subtitle: 'Submit Listing', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: '/emergency', label: '🆘 အရေးပေါ် (Emergency)', icon: '🆘', title: 'Emergency', title_mm: 'အရေးပေါ်', subtitle: 'Emergency', css: 'bg-gradient-to-br from-red-600/25 to-red-700/10 border border-red-500/30 text-white hover:border-red-500/50' },
  { url: '/fuel', label: '⛽ ဓာတ်ဆီဆိုင်များ (Fuel Stations)', icon: '⛽', title: 'Fuel Stations', title_mm: 'ဓာတ်ဆီဆိုင်များ', subtitle: 'ဓာတ်ဆီဆိုင်များ', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: '/news', label: '📰 သတင်းနှင့် ဖြစ်ရပ်များ (News & Events)', icon: '📰', title: 'News & Events', title_mm: 'သတင်းများ', subtitle: 'နောက်ဆုံးရသတင်း', css: 'bg-white/5 border-white/10 text-white hover:bg-white/8' },
  { url: 'custom', label: '🔗 အခြားလင့်ခ် ကိုယ်တိုင်ထည့်မည် (Custom URL)' }
]

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading, isAdmin, isModerator, isSuperAdmin } = useAuth()
  const { log } = useAuditLog()
  const isAuthorized = isAdmin || isModerator

  const [tab, setTab]                 = useState('dashboard') 
  const [data, setData]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [listingFilter, setListingFilter] = useState('all')
  const [editingId, setEditingId]     = useState(null)
  const [editForm, setEditForm]       = useState({})
  const [editOriginal, setEditOriginal] = useState(null) // M6 (v9.17): row before the edit, for the audit log
  const [listingsLimit, setListingsLimit] = useState(50) // S2 (v9.17): admin listings pagination
  const [listingsHasMore, setListingsHasMore] = useState(false)
  const [usersLimit, setUsersLimit] = useState(50) // S2 (v9.17): admin users pagination
  const [usersHasMore, setUsersHasMore] = useState(false)
  const [reports, setReports]         = useState({})
  const [deleting, setDeleting]       = useState(null)
  // Unfiltered pending count for the filter badge (G7) — the listing
  // list itself is server-filtered, so it can never be counted from it.
  const [pendingListingsCount, setPendingListingsCount] = useState(0)
  // Busy id for the donation-permission toggle (moderators only).
  const [donationBusy, setDonationBusy] = useState(null)

  // Dashboard Stats (no "Online Now" / "Active Today" — nothing
  // updates profiles on login/activity, so those tiles were fake)
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    newToday: 0,
    newLast7Days: 0,
    listings: { approved: 0, pending: 0, suspended: 0 },
    posts: { news: 0, events: 0, announcements: 0 },
    totalReviews: 0,
    usersByRole: { admin: 0, moderator: 0, member: 0 }
  })
  const [statsLoading, setStatsLoading] = useState(true)

  const [usersList, setUsersList] = useState([])
  const [userSearch, setUserSearch] = useState('')

  const [quickLinks, setQuickLinks] = useState([])
  const [editingLink, setEditingLink] = useState(null)
  const [linkForm, setLinkForm] = useState({ title: '', title_mm: '', subtitle: '', icon: '🔗', url: '', css_classes: 'bg-white/5 border-white/10 text-white hover:bg-white/8', sort_order: 0, is_active: true })
  const [linkLoading, setLinkLoading] = useState(false)

  const [claims, setClaims] = useState([])
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [claimBusy, setClaimBusy] = useState(null)
  // Pending-claim count for the tab badge — loaded on mount, not only
  // when the claims tab opens (H-M1: the badge could never appear).
  const [pendingClaims, setPendingClaims] = useState(0)
  // Per-listing busy id for Approve/Suspend (H-L5).
  const [listingBusy, setListingBusy] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  // Data tab (v9.16) — admin-only export view: listings + users + visitor stats.
  const [visitStats, setVisitStats] = useState(null)
  const [visitStatsLoading, setVisitStatsLoading] = useState(false)
  const [dataRows, setDataRows] = useState([])
  const [dataUsers, setDataUsers] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [exportBusy, setExportBusy] = useState(null)

  async function loadListings() {
    setLoading(true)
    try {
      let query = supabase
        .from('listings')
        .select('*, category:categories(name, name_mm), submitter:profiles!submitted_by(full_name)')
        .order('created_at', { ascending: false })

      if (listingFilter === 'suspended')      query = query.eq('status', 'suspended')
      else if (listingFilter === 'approved')  query = query.eq('status', 'approved')
      else if (listingFilter === 'pending')   query = query.eq('status', 'pending')
      else query = query.neq('status', 'suspended')

      // S2 (v9.17): page the admin list (was: every listing at once).
      // Fetch one extra row to know whether a Load more button is needed.
      query = query.range(0, listingsLimit)
      // 30 s timeout (was none): a hung listings query left the admin
      // table on skeletons forever.
      const { data: rows, error } = await withTimeout(query, 30000, 'Admin listings')
      if (error) throw error
      setListingsHasMore((rows || []).length > listingsLimit)
      setData((rows || []).slice(0, listingsLimit))
      // The rows are visible now. The badge/report counts below are
      // secondary: each has its own timeout and must never gate the
      // list (a hung count query used to hold loading=true).
      setLoading(false)

      // Pending badge count (G7) — counted from ALL listings, never
      // from the filtered list above.
      try {
        const { count: pendingCount } = await withTimeout(supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'), 30000, 'Admin pending count')
        setPendingListingsCount(pendingCount || 0)
      } catch (countErr) { console.warn('Pending count failed:', countErr) }

      if (rows) {
        // One query for all report counts (was N+1 sequential
        // per-listing count queries) — tally client-side.
        try {
          const { data: repRows } = await withTimeout(supabase
            .from('listing_reports')
            .select('listing_id')
            .in('listing_id', rows.map(r => r.id)), 30000, 'Admin report counts')
          const reportCounts = {}
          rows.forEach(r => { reportCounts[r.id] = 0 })
          ;(repRows || []).forEach(rr => {
            if (rr.listing_id in reportCounts) reportCounts[rr.listing_id]++
          })
          setReports(reportCounts)
        } catch (repErr) { console.warn('Report counts failed:', repErr) }
      }
    } catch (e) {
      console.error('loadListings error:', e)
      showError('Listings ရယူရာတွင် အမှားရှိသည်: ' + e.message)
    }
    setLoading(false)
  }

  async function loadDashboardStats() {
    setStatsLoading(true)
    try {
      // Myanmar day boundary — never UTC midnight.
      const todayStr = yangonToday() + 'T00:00:00+06:30'
      // sevenDaysAgo from the SAME Yangon day boundary (today minus 7
      // days at Yangon midnight), not "now minus 7d" in UTC — the old
      // toISOString() version was up to ~6.5h off.
      const [yy, mm, dd] = yangonToday().split('-').map(Number)
      // S5 (v9.17): "New (7d)" is 7 days inclusive — today minus 6 days,
      // not today minus 7 (which spans 8 calendar days).
      const seven = new Date(Date.UTC(yy, mm - 1, dd - 6))
      const weekAgo = seven.toISOString().slice(0, 10) + 'T00:00:00+06:30'

      // Parallel + allSettled + one 30 s timeout (was 13 sequential
      // awaits with no timeout): on slow mobile data the sequence
      // could take far longer than any single query, and one hung
      // count held the stats spinner forever. One failed count now
      // reads 0 instead of blanking every stat.
      const countQueries = [
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        // Server-side counts per role (was: download every profile row
        // and count client-side — wrong past 1,000 users). "member" is
        // every non-null role that is neither admin nor moderator, which
        // is exactly what the old client-side tally computed.
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'moderator'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).not('role', 'is', null),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('type', 'news'),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('type', 'event'),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('type', 'announcement'),
        supabase.from('reviews').select('*', { count: 'exact', head: true }),
        // M4 (v9.17): super_admins were counted inside "member" — count
        // them separately so they can be subtracted like admin/moderator.
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'super_admin'),
      ]
      const countResults = await withTimeout(Promise.allSettled(countQueries), 30000, 'Dashboard stats')
      const c = (i) => (countResults[i].status === 'fulfilled' ? (countResults[i].value?.count || 0) : 0)
      const totalUsers = c(0)
      const newToday = c(1)
      const newLast7Days = c(2)
      const adminCount = c(3)
      const moderatorCount = c(4)
      const nonNullRoleCount = c(5)
      const superAdminCount = c(13)
      const usersByRole = {
        admin: adminCount || 0,
        moderator: moderatorCount || 0,
        // M4: member is every non-null role that is neither admin,
        // moderator nor super_admin.
        member: Math.max(0, (nonNullRoleCount || 0) - (adminCount || 0) - (moderatorCount || 0) - (superAdminCount || 0)),
      }

      const approvedListings = c(6)
      const pendingListings = c(7)
      const suspendedListings = c(8)

      const newsPosts = c(9)
      const eventPosts = c(10)
      const announcementPosts = c(11)

      const totalReviews = c(12)

      setDashboardStats({
        totalUsers: totalUsers || 0,
        newToday: newToday || 0,
        newLast7Days: newLast7Days || 0,
        listings: {
          approved: approvedListings || 0,
          pending: pendingListings || 0,
          suspended: suspendedListings || 0
        },
        posts: {
          news: newsPosts || 0,
          events: eventPosts || 0,
          announcements: announcementPosts || 0
        },
        totalReviews: totalReviews || 0,
        usersByRole
      })
    } catch (e) { console.warn('Stats Error:', e) }
    setStatsLoading(false)
  }

  async function loadUsers() {
    setLoading(true)
    try {
      // 30 s timeout (was none): a hung query left the users table on skeletons forever.
      const { data, error } = await withTimeout(supabase.from('profiles').select('*').order('created_at', { ascending: false }).range(0, usersLimit), 30000, 'Admin users')
      if (error) throw error
      setUsersHasMore((data || []).length > usersLimit)
      setUsersList((data || []).slice(0, usersLimit))
    } catch (e) {
      console.warn('Load users error:', e)
      showError('Users ရယူရာတွင် အမှားရှိသည်: ' + e.message)
    }
    setLoading(false)
  }

  async function loadClaims() {
    setClaimsLoading(true)
    try {
      // 30 s timeout (was none): a hung query left the claims list on skeletons forever.
      const { data, error } = await withTimeout(supabase
        .from('listing_claims')
        .select('*, listing:listings(name, name_mm), claimant:profiles!user_id(full_name, nickname)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }), 30000, 'Admin claims')
      if (error) throw error
      setClaims(data || [])
    } catch (e) {
      console.error('loadClaims error:', e)
      showError('ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်းများ ရယူရာတွင် အမှားရှိသည်: ' + e.message)
    }
    setClaimsLoading(false)
  }

  async function loadPendingClaimCount() {
    // N1 (v9.17): a hung/failed count must not crash the tab — the badge
    // simply keeps its previous value.
    try {
      const { count } = await withTimeout(supabase
        .from('listing_claims')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'), 30000, 'Admin pending claims')
      setPendingClaims(count || 0)
    } catch (e) { console.warn('Pending claim count failed:', e) }
  }

  // Data tab (v9.16): everything the Admin needs to take the data out.
  // Listings use the admin RLS policy ("Admins can view all listings") so
  // ALL statuses are included, not just the listings tab's filter. Users
  // come from profiles (select * — the admin already receives every
  // column). Visitor stats come from the get_visit_stats RPC (aggregates
  // only — raw visit rows are never exposed). Each section tolerates its
  // own failure: one failed query shows '—'/0, never blanks the tab.
  async function loadDataTab() {
    setDataLoading(true)
    setVisitStatsLoading(true)
    try {
      const [listRes, userRes, visitRes] = await Promise.allSettled([
        withTimeout(supabase
          .from('listings')
          .select('*, category:categories(name, name_mm), submitter:profiles!submitted_by(full_name)')
          .order('created_at', { ascending: false }), 30000, 'Admin data listings'),
        withTimeout(supabase.from('profiles').select('*').order('created_at', { ascending: false }), 30000, 'Admin data users'),
        withTimeout(supabase.rpc('get_visit_stats'), 30000, 'Admin visit stats'),
      ])
      if (listRes.status === 'fulfilled' && !listRes.value.error) setDataRows(listRes.value.data || [])
      else console.warn('Data listings failed:', listRes.status === 'fulfilled' ? listRes.value.error : listRes.reason)
      if (userRes.status === 'fulfilled' && !userRes.value.error) setDataUsers(userRes.value.data || [])
      else console.warn('Data users failed:', userRes.status === 'fulfilled' ? userRes.value.error : userRes.reason)
      if (visitRes.status === 'fulfilled' && !visitRes.value.error && visitRes.value.data) setVisitStats(visitRes.value.data)
      else console.warn('Visit stats failed:', visitRes.status === 'fulfilled' ? visitRes.value.error : visitRes.reason)
    } catch (e) { console.warn('Data tab load failed:', e) }
    setDataLoading(false)
    setVisitStatsLoading(false)
  }

  function downloadCSV(filename, headers, rows) {
    if (!rows || rows.length === 0) { showError('ဒေါင်းလုတ်လုပ်ရန် Data မရှိပါ'); return }
    try {
      const blob = new Blob([toCSV(headers, rows)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      showSuccess('✓ CSV ဒေါင်းလုတ်လုပ်ပြီးပါပြီ')
    } catch (e) { showError('CSV ဒေါင်းလုတ်မရပါ: ' + e.message) }
  }

  function exportListingsCSV() {
    setExportBusy('listings')
    const date = yangonToday()
    const headers = ['name', 'name_mm', 'category', 'city', 'township', 'address', 'phone_1', 'phone_2', 'viber', 'telegram', 'facebook', 'website', 'status', 'is_verified', 'is_featured', 'rating_avg', 'rating_count', 'submitted_by', 'created_at']
    const rows = dataRows.map(r => [
      r.name, r.name_mm, r.category?.name_mm || r.category?.name, r.city, r.township, r.address,
      r.phone_1, r.phone_2, r.viber, r.telegram, r.facebook, r.website,
      r.status, r.is_verified ? 'yes' : 'no', r.is_featured ? 'yes' : 'no',
      r.rating_avg, r.rating_count, r.submitter?.full_name, r.created_at,
    ])
    downloadCSV(`cherry-listings-${date}.csv`, headers, rows)
    setExportBusy(null)
  }

  function exportUsersCSV() {
    setExportBusy('users')
    const date = yangonToday()
    const headers = ['full_name', 'username', 'role', 'phone', 'created_at']
    const rows = dataUsers.map(u => [u.full_name, u.username, u.role || 'member', u.phone, u.created_at])
    downloadCSV(`cherry-users-${date}.csv`, headers, rows)
    setExportBusy(null)
  }

  function exportVisitsCSV(kind) {
    setExportBusy('visits-' + kind)
    const date = yangonToday()
    if (kind === 'daily') {
      const headers = ['date', 'visits']
      const rows = (visitStats?.daily || []).map(d => [d.date, d.count])
      downloadCSV(`cherry-visits-daily-${date}.csv`, headers, rows)
    } else {
      const headers = ['country_code', 'country', 'visits']
      const rows = (visitStats?.by_country || []).map(c => [c.code, c.name, c.count])
      downloadCSV(`cherry-visits-countries-${date}.csv`, headers, rows)
    }
    setExportBusy(null)
  }

  async function handleClaimDecision(claim, approve) {
    const verb = approve ? 'အတည်ပြု' : 'ပယ်ချ'
    if (!(await confirmDialog(`"${claim.listing?.name_mm || claim.listing?.name || 'လုပ်ငန်း'}" ၏ ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်းကို ${verb}မည်လား?${approve ? ' (တောင်းဆိုသူကို +30 အမှတ် ရပြီး လုပ်ငန်းပိုင်ရှင် ဖြစ်သွားမည်)' : ''}`))) return
    setClaimBusy(claim.id)
    try {
      if (approve) {
        // Guard: never approve a claim on a listing that already has an
        // owner — the trigger would silently transfer ownership.
        const { data: listing, error: listingErr } = await supabase
          .from('listings')
          .select('owner_id')
          .eq('id', claim.listing_id)
          .maybeSingle()
        if (listingErr) throw listingErr
        if (listing?.owner_id) {
          showError('ဤလုပ်ငန်းတွင် ပိုင်ရှင် ရှိနေပြီးဖြစ်သည် — ပိုင်ဆိုင်ကြောင်း အတည်ပြု၍ မရပါ')
          setClaimBusy(null)
          return
        }
      }
      // Guard: only a still-pending claim can be decided. Two admins
      // deciding at once must not both see "+30 points".
      const { data: decided, error } = await supabase
        .from('listing_claims')
        .update({ status: approve ? 'approved' : 'rejected', reviewed_by: user?.id || null })
        .eq('id', claim.id)
        .eq('status', 'pending')
        .select('id')
      if (error) throw error
      if (!decided || decided.length === 0) {
        showError('ဤ ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်းကို အခြား Admin မှ ဆုံးဖြတ်ပြီးဖြစ်သည်')
        loadClaims()
        loadPendingClaimCount()
        setClaimBusy(null)
        return
      }
      if (approve) {
        // The claim-approval trigger sets is_verified + owner_id; it
        // (Track 5) also sets verify_type='owner'. Mirror that here so
        // the listing does not keep a stale verify_type='cherry' from
        // an earlier admin approval (which would keep showing the
        // "🍒 Cherry Directory Verified" badge above the owner card).
        // S3 (v9.17): re-check ownership in the same update — the
        // trigger sets owner_id = this claimant, so a 0-row result means
        // another admin's approval won the race. N2: surface the failure
        // instead of swallowing it in console.warn.
        const { data: vtRows, error: vtErr } = await supabase
          .from('listings')
          .update({ verify_type: 'owner' })
          .eq('id', claim.listing_id)
          .eq('owner_id', claim.user_id)
          .select('id')
        if (vtErr) { showError('verify_type ပြင်မရပါ: ' + vtErr.message); setClaimBusy(null); return }
        if (!vtRows || vtRows.length === 0) {
          showError('ဤလုပ်ငန်း၏ ပိုင်ရှင်ကို အခြား Admin မှ အတည်ပြုပြီးဖြစ်သည်')
          loadClaims()
          loadPendingClaimCount()
          setClaimBusy(null)
          return
        }
      }
      // The DB trigger handle_claim_approved() verifies ownership
      // (is_verified + owner_id); handle_claim_points() awards +30.
      // Audit log is fire-and-forget — it must never delay the toast.
      log({
        action: approve ? 'approve' : 'reject',
        table: 'listing_claims',
        id: claim.id,
        name: claim.listing?.name_mm || claim.listing?.name,
        after: { status: approve ? 'approved' : 'rejected' },
      }).then(ok => { if (!ok) console.warn('Audit log failed for claim decision') })
      showSuccess(approve ? '✓ ပိုင်ဆိုင်ကြောင်း အတည်ပြုပြီးပါပြီ (+30 အမှတ်)' : 'ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်း ပယ်ချပြီးပါပြီ')
      loadClaims()
      loadPendingClaimCount()
      loadDashboardStats()
    } catch (e) {
      showError('ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်း ' + verb + 'ရာတွင် အမှားရှိသည်: ' + e.message)
    }
    setClaimBusy(null)
  }

  async function handleRoleChange(userId, newRole) {
    const target = usersList.find(u => u.id === userId)
    const oldRole = target?.role || 'member'
    if (newRole === oldRole) return
    // Only a super_admin may change roles (DB trigger enforces it too).
    if (!isSuperAdmin) {
      showError('Role ပြောင်းရန် Super Admin သာ ခွင့်ရှိသည်')
      return
    }
    // Never demote yourself.
    if (userId === user?.id) {
      showError('ကိုယ့်ရဲ့ Role ကို ကိုယ်တိုင်ပြောင်းလို့မရပါ')
      loadUsers()
      return
    }
    // Never demote the last super_admin.
    if (oldRole === 'super_admin' && newRole !== 'super_admin') {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin')
      if (error) {
        showError('Super Admin အရေအတွက် စစ်ဆေးမရပါ: ' + error.message)
        return
      }
      if ((count || 0) <= 1) {
        showError('နောက်ဆုံး Super Admin ဖြစ်နေလို့ Role ပြောင်းလို့မရပါ')
        loadUsers()
        return
      }
    }
    if (!(await confirmDialog(`ဒီ User ကို ${newRole.toUpperCase()} Role ပြောင်းပေးမှာ သေချာပြီလား?`))) {
      loadUsers()
      return
    }
    try {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
      if (error) throw error
      if (updated && updated.length > 0) {
        // Audit log is fire-and-forget — it must never delay the toast.
        log({
          action: 'update_role',
          table: 'profiles',
          id: userId,
          name: target?.full_name || target?.nickname,
          before: { role: oldRole },
          after: { role: newRole },
        }).then(ok => { if (!ok) console.warn('Audit log failed for role change') })
        showSuccess(`✓ Role ကို ${newRole} သို့ ပြောင်းလဲပြီးပါပြီ`)
        loadUsers()
        loadDashboardStats()
      } else {
        throw new Error('No rows updated – check RLS policy')
      }
    } catch (e) {
      showError(`Error: ${e.message}`)
      loadUsers()
    }
  }

  // Donation permission (Admin-granted, per moderator): only Admins
  // may grant/revoke it. Calls the SECURITY DEFINER RPC
  // set_donation_permission (supabase-migration-9.5.sql, Track E) —
  // the client never writes profiles.can_manage_donations directly.
  async function handleDonationPermission(mod, allowed) {
    setDonationBusy(mod.id)
    const { error } = await supabase.rpc('set_donation_permission', { p_user_id: mod.id, p_allowed: allowed })
    setDonationBusy(null)
    if (error) {
      showError('အလှူငွေ ခွင့်ပြုချက် ပြောင်းမရပါ: ' + error.message)
      return
    }
    setUsersList(prev => prev.map(u => u.id === mod.id ? { ...u, can_manage_donations: allowed } : u))
    showSuccess(allowed ? '✓ အလှူငွေ ပြင်ခွင့် ပေးပြီးပါပြီ' : 'အလှူငွေ ပြင်ခွင့် ရုပ်သိမ်းပြီးပါပြီ')
  }

  async function loadQuickLinks() {
    setLinkLoading(true)
    try {
      const { data, error } = await supabase.from('quick_links').select('*').order('sort_order')
      if (error) throw error
      setQuickLinks(data || [])
    } catch (e) {
      console.error('loadQuickLinks error:', e)
      showError('Link များ ရယူရာတွင် အမှားရှိသည်: ' + e.message)
    } finally {
      setLinkLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !isAuthorized) return
    loadPendingClaimCount()
    if (tab === 'listings') loadListings()
    if (tab === 'dashboard') loadDashboardStats()
    if (tab === 'quicklinks') loadQuickLinks()
    if (tab === 'users') loadUsers()
    if (tab === 'claims') loadClaims()
    if (tab === 'data') loadDataTab()
  }, [tab, listingFilter, listingsLimit, usersLimit, authLoading, isAuthorized])

  async function handleApprove(id) {
    setListingBusy(id)
    try {
      const { data: updated, error } = await supabase
        .from('listings')
        .update({ 
          status: 'approved',
          is_verified: true,
          verify_type: 'cherry'
        })
        .eq('id', id)
        .select('name, name_mm')
      if (error) throw error
      const name = updated?.[0]?.name_mm || updated?.[0]?.name
      // Audit log is fire-and-forget — it must never delay the toast.
      log({ action: 'approve', table: 'listings', id, name, after: { status: 'approved' } })
        .then(ok => { if (!ok) console.warn('Audit log failed for listing approve') })
      showSuccess('✓ အတည်ပြုပြီးပါပြီ (Cherry Verified) 🍒')
      loadListings()
      loadDashboardStats()
    } catch (e) {
      showError('အတည်ပြုရာတွင် အမှားရှိသည်: ' + e.message)
    }
    setListingBusy(null)
  }

  async function handleSuspend(id) {
    setListingBusy(id)
    try {
      const { data: updated, error } = await supabase
        .from('listings')
        .update({ status: 'suspended' })
        .eq('id', id)
        .select('name, name_mm')
      if (error) throw error
      const name = updated?.[0]?.name_mm || updated?.[0]?.name
      // Audit log is fire-and-forget — it must never delay the toast.
      log({ action: 'suspend', table: 'listings', id, name, after: { status: 'suspended' } })
        .then(ok => { if (!ok) console.warn('Audit log failed for listing suspend') })
      showSuccess('ဆိုင်းငံ့ထားပြီးပါပြီ')
      loadListings()
      loadDashboardStats()
    } catch (e) {
      showError('ဆိုင်းငံ့ရာတွင် အမှားရှိသည်: ' + e.message)
    }
    setListingBusy(null)
  }

  async function handleDelete(id) {
    if (!(await confirmDialog('လုပ်ငန်းကို အမှန်ဖျက်မလား? ဒီလုပ်ငန်းကို ပြန်မရနိုင်ပါ။', { danger: true }))) return
    setDeleting(id)
    try {
      // Delete the listing FIRST, then clean up linked rows: the old
      // order deleted reviews/reports/suggestions first, so a failure
      // on the final listing delete left them already gone.
      const { data: deleted, error } = await supabase.from('listings').delete().eq('id', id).select('name, name_mm')
      if (error) throw error
      const name = deleted?.[0]?.name_mm || deleted?.[0]?.name
      // Best-effort cleanup of linked rows — a failure here must not
      // silently block the delete, but it must not be hidden either.
      const cleanupErrors = []
      const { error: repErr } = await supabase.from('reports').delete().eq('target_type', 'listing').eq('target_id', id)
      if (repErr) cleanupErrors.push('reports: ' + repErr.message)
      const { error: sugErr } = await supabase.from('edit_suggestions').delete().eq('listing_id', id)
      if (sugErr) cleanupErrors.push('edit_suggestions: ' + sugErr.message)
      const { error: revErr } = await supabase.from('reviews').delete().eq('listing_id', id)
      if (revErr) cleanupErrors.push('reviews: ' + revErr.message)
      // Audit log is fire-and-forget — it must never delay the toast.
      log({ action: 'delete', table: 'listings', id, name, before: { name } })
        .then(ok => { if (!ok) console.warn('Audit log failed for listing delete') })
      showSuccess(cleanupErrors.length > 0
        ? '🗑️ ဖျက်ပြီးပါပြီ (ဆက်စပ်အချက်အလက် အချို့ ဖျက်မရပါ: ' + cleanupErrors.join('; ') + ')'
        : '🗑️ ဖျက်ပြီးပါပြီ')
      loadListings()
      loadDashboardStats()
    } catch (e) { showError('ဖျက်ရာတွင် အမှားတစ်ခု ဖြစ်သွားသည်: ' + e.message) }
    setDeleting(null)
  }

  async function handleEdit(listing) {
    setEditingId(listing.id)
    setEditForm(listing)
    setEditOriginal(listing) // M6 (v9.17): the audit log needs the BEFORE row
  }

  async function handleSaveEdit(id) {
    const { name, name_mm, description, description_mm, address, phone_1, city, township } = editForm
    // S4 (v9.17): a listing needs at least one name, and a phone must be
    // a real number when given — same rules as the public forms.
    if (!name?.trim() && !name_mm?.trim()) { showError('လုပ်ငန်းအမည် (မြန်မာ သို့မဟုတ် English) တစ်ခု ထည့်ပါ'); return }
    if (phone_1?.trim() && !validatePhone(phone_1)) { showError('ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ'); return }
    setEditSaving(true)
    const { error } = await supabase.from('listings').update({
      name, name_mm, description, description_mm, address, phone_1, city, township
    }).eq('id', id)
    if (error) { setEditSaving(false); return showError('သိမ်းရာတွင် အမှားဖြစ်သည်: ' + error.message) }

    // Audit log (fire-and-forget) — edit previously had no audit entry.
    log({ action: 'update', table: 'listings', id, name: name_mm || name, before: editOriginal, after: { name, name_mm, description, description_mm, address, phone_1, city, township } })
      .then(ok => { if (!ok) console.warn('Audit log failed for listing edit') })
    setEditingId(null)
    setEditSaving(false)
    showSuccess('✓ ပြင်ဆင်မှု သိမ်းဆည်းပြီး')
    loadListings()
  }

  async function handleSaveLink() {
    if (!linkForm.title || !linkForm.url) {
      showError('Title နှင့် URL ထည့်ရန်လိုအပ်ပါတယ်')
      return
    }
    // N3 (v9.17): a saved link must be a real http(s) URL (no javascript:)
    // and its CSS classes must be plain class names — no url()/expressions.
    if (!validateUrl(linkForm.url)) { showError('URL မှန်ကန်စွာ ထည့်ပါ (https://...)'); return }
    if (/url\s*\(|expression\s*\(|[;<>"'`]/.test(linkForm.css_classes || '')) { showError('CSS classes တွင် url() / အထူးစာလုံး ပါလို့ မရပါ'); return }

    const payload = { ...linkForm }
    delete payload.id

    try {
      if (editingLink) {
        const { error } = await supabase.from('quick_links').update(payload).eq('id', editingLink)
        if (error) throw error
        showSuccess('✓ ပြင်ဆင်ပြီးပါပြီ')
      } else {
        payload.sort_order = quickLinks.length + 1
        const { error } = await supabase.from('quick_links').insert([payload])
        if (error) throw error
        showSuccess('✓ အသစ်ထည့်ပြီးပါပြီ')
      }
      setEditingLink(null)
      setLinkForm({ title: '', title_mm: '', subtitle: '', icon: '🔗', url: '', css_classes: 'bg-white/5 border-white/10 text-white hover:bg-white/8', sort_order: 0, is_active: true })
      await loadQuickLinks()
    } catch (e) {
      console.error('Save link error:', e)
      showError(`Error: ${e.message}`)
    }
  }

  async function handleDeleteLink(id) {
    if (!(await confirmDialog('ဖျက်မှာသေချာပြီလား?', { danger: true }))) return
    try {
      const { error } = await supabase.from('quick_links').delete().eq('id', id)
      if (error) throw error
      showSuccess('ဖျက်ပြီးပါပြီ')
      await loadQuickLinks()
    } catch (e) {
      console.error('Delete link error:', e)
      showError(`Error: ${e.message}`)
    }
  }

  // S6 (v9.17): search matches name, username, nickname and phone.
  const superAdminCount = usersList.filter(u => u.role === 'super_admin').length
  const filteredUsers = usersList.filter(u => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return true
    return [u.full_name, u.username, u.nickname, u.phone].some(v => (v || '').toLowerCase().includes(q))
  })

  // Data tab derived values (v9.16) — computed at top level so the JSX stays clean.
  const visitTotal = Number(visitStats?.total) || 0
  const visitPct = devicePercentages(visitStats?.by_device, visitTotal)
  const visitTopCountry = visitStats?.by_country?.[0] || null
  const visitPeak = formatPeakHour(visitStats?.by_hour)

  // Render guard: the route guard in App.jsx is the first line of
  // defence; this page never renders the panel to a non-admin/mod
  // once the role is known (profile loaded).
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh] px-8 text-center">
        <p className="text-white/50 font-myanmar">စစ်ဆေးနေသည်...</p>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] px-8 text-center gap-3">
        <Lock size={32} className="text-white/30" />
        <p className="text-white/50 font-myanmar">🔒 Admin / Moderator သာ ကြည့်နိုင်သည်</p>
        <button onClick={() => navigate('/')} className="btn-primary text-xs px-4 py-2">Home ပြန်မည်</button>
      </div>
    )
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-2 border-b border-white/10 mb-4 sticky top-[var(--header-h)] bg-[#140020] z-50">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h1 className="font-display font-bold text-lg text-white">စီမံခန့်ခွဲမှု</h1>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setTab('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'dashboard' ? 'bg-brand-600 text-white' : 'bg-white/5 text-white/60'}`}>
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button onClick={() => setTab('data')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'data' ? 'bg-teal-600 text-white' : 'bg-white/5 text-white/60'}`}>
            <Database size={14} /> Data
          </button>
          <button onClick={() => setTab('users')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'users' ? 'bg-pink-600 text-white' : 'bg-white/5 text-white/60'}`}>
            <UserCog size={14} /> Users
          </button>
          <button onClick={() => setTab('listings')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'listings' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60'}`}>
            <List size={14} /> Listings
          </button>
          <button onClick={() => setTab('claims')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'claims' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-white/60'}`}>
            <BadgeCheck size={14} /> ပိုင်ဆိုင်ကြောင်း
            {pendingClaims > 0 && tab !== 'claims' && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-[8px] text-white">{pendingClaims}</span>
            )}
          </button>
          <button onClick={() => setTab('categories')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'categories' ? 'bg-amber-600 text-white' : 'bg-white/5 text-white/60'}`}>
            <FolderTree size={14} /> Categories
          </button>
          <button onClick={() => setTab('quicklinks')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${tab === 'quicklinks' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60'}`}>
            <LinkIcon size={14} /> Quick Links
          </button>
        </div>

        {/* Admin tools — Reports / Bulk Import / Settings (G3) */}
        <div className="flex gap-2 pb-2">
          <button onClick={() => navigate('/admin/reports')} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-colors whitespace-nowrap">
            🚩 Reports
          </button>
          <button onClick={() => navigate('/admin/bulk-import')} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-colors whitespace-nowrap">
            📥 Bulk Import
          </button>
          <button onClick={() => navigate('/admin/settings')} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-colors whitespace-nowrap">
            ⚙️ Settings
          </button>
        </div>
      </div>

      {tab === 'dashboard' && (
        <div className="px-4 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold font-display flex items-center gap-2">
              <Shield size={18} className="text-brand-400" /> Platform Analytics
            </h2>
            <button onClick={loadDashboardStats} disabled={statsLoading} className="text-brand-300 hover:text-brand-200 transition-colors">
              <RefreshCw size={16} className={statsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {statsLoading ? (
            <div className="text-center py-8 text-white/60">Loading stats...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard title="Total Users" value={dashboardStats.totalUsers} icon={Users} color="text-blue-400" />
                <StatCard title="New Today" value={dashboardStats.newToday} icon={UserCog} color="text-yellow-400" />
                <StatCard title="New (7d)" value={dashboardStats.newLast7Days} icon={TrendingUp} color="text-amber-400" />
                <StatCard title="Total Reviews" value={dashboardStats.totalReviews} icon={Star} color="text-gold-400" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatCard title="Admins" value={dashboardStats.usersByRole.admin} icon={Users} color="text-purple-400" size="small" />
                <StatCard title="Moderators" value={dashboardStats.usersByRole.moderator} icon={Users} color="text-indigo-400" size="small" />
                <StatCard title="Members" value={dashboardStats.usersByRole.member} icon={Users} color="text-white/60" size="small" />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-white/70 mb-2">📋 Listings</h3>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard title="Approved" value={dashboardStats.listings.approved} icon={Check} color="text-green-400" size="small" />
                  <StatCard title="Pending" value={dashboardStats.listings.pending} icon={AlertCircle} color="text-yellow-400" size="small" />
                  <StatCard title="Suspended" value={dashboardStats.listings.suspended} icon={EyeOff} color="text-red-400" size="small" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-white/70 mb-2">📰 Posts</h3>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard title="News" value={dashboardStats.posts.news} icon={FileText} color="text-blue-400" size="small" />
                  <StatCard title="Events" value={dashboardStats.posts.events} icon={Calendar} color="text-green-400" size="small" />
                  <StatCard title="Announcements" value={dashboardStats.posts.announcements} icon={Megaphone} color="text-amber-400" size="small" />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'data' && (
        <div className="px-4 space-y-6 animate-fade-in">
          <p className="text-xs text-white/50 font-myanmar">Admin သာ ကြည့်နိုင်သည် — လုပ်ငန်း / User / လာကြည့်သူ ဒေတာကို CSV အဖြစ် ယူလို့ရသည် (Excel မှာ ဖွင့်လို့ရ)</p>

          {/* Visitor stats (v9.16) — same get_visit_stats RPC as /visitors */}
          <div>
            <h3 className="text-sm font-semibold text-white/70 mb-2">👀 လာကြည့်သူများ</h3>
            {visitStatsLoading ? (
              <p className="text-white/60 text-center py-4 text-sm">Loading...</p>
            ) : visitStats === null ? (
              <p className="text-white/60 text-center py-4 text-sm font-myanmar">လာကြည့်သူ စာရင်းအင်း မရသေးပါ (—)</p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard title="Total" value={visitTotal} icon={Users} color="text-blue-400" />
                  <StatCard title="Today" value={Number(visitStats.today) || 0} icon={TrendingUp} color="text-yellow-400" />
                  <StatCard title="This week" value={Number(visitStats.week) || 0} icon={TrendingUp} color="text-amber-400" />
                  <StatCard title="This month" value={Number(visitStats.month) || 0} icon={TrendingUp} color="text-white/60" />
                </div>
                <div className="mt-3 space-y-1 text-xs text-white/70">
                  <p>📱 ဖုန်း {visitPct.phone}% • 💻 ကွန်ပျူတာ {visitPct.desktop}%{Number(visitStats.by_device?.tablet) > 0 ? ` • 📟 Tablet ${visitPct.tablet}%` : ''}</p>
                  <p>🌍 အများဆုံး: {visitTopCountry ? `${visitTopCountry.name} (${Number(visitTopCountry.count).toLocaleString()})` : '—'}</p>
                  <p>🕐 အကြည့်များဆုံးအချိန်: {visitPeak || '—'}</p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => exportVisitsCSV('daily')} disabled={exportBusy !== null} className="flex-1 px-3 py-2.5 bg-white/8 border border-white/10 text-white/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Download size={14} /> နေ့စဉ် CSV
                  </button>
                  <button onClick={() => exportVisitsCSV('countries')} disabled={exportBusy !== null} className="flex-1 px-3 py-2.5 bg-white/8 border border-white/10 text-white/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Download size={14} /> နိုင်ငံ CSV
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Listings export */}
          <div>
            <h3 className="text-sm font-semibold text-white/70 mb-2">📋 လုပ်ငန်းများ ({dataRows.length.toLocaleString()})</h3>
            <button onClick={exportListingsCSV} disabled={dataLoading || exportBusy !== null} className="w-full px-3 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Download size={14} /> {exportBusy === 'listings' ? '...' : 'Listings CSV ဒေါင်းလုတ်'}
            </button>
            <p className="text-[10px] text-white/40 mt-1.5 font-myanmar">အခြေအနေ အားလုံး (Approved / Pending / Suspended) ပါဝင်သည်</p>
          </div>

          {/* Users export */}
          <div>
            <h3 className="text-sm font-semibold text-white/70 mb-2">👥 Users ({dataUsers.length.toLocaleString()})</h3>
            <button onClick={exportUsersCSV} disabled={dataLoading || exportBusy !== null} className="w-full px-3 py-2.5 bg-pink-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Download size={14} /> {exportBusy === 'users' ? '...' : 'Users CSV ဒေါင်းလုတ်'}
            </button>
            <p className="text-[10px] text-white/40 mt-1.5 font-myanmar">နာမည် / Role / ဖုန်း / စတင်သည့်ရက် — Admin သာ ကြည့်နိုင်သည်</p>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <Search size={16} className="text-white/40" />
            <input 
              type="text" 
              placeholder="နာမည်ဖြင့် ရှာရန်..." 
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-white w-full font-myanmar placeholder:text-white/30"
            />
          </div>

          <div className="space-y-2">
            {loading ? (
              <p className="text-white/60 text-center py-8">Loading users...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-white/60 text-center py-8 font-myanmar">User မတွေ့ပါ</p>
            ) : (
              filteredUsers.map(u => (
                <div key={u.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.full_name?.[0] || '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{u.full_name || 'Anonymous'}</p>
                      <p className="text-[10px] text-white/60 truncate">Joined: {formatMyanmarDate(u.created_at, { year: true })}</p>
                    </div>
                    {u.role === 'super_admin' && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex-shrink-0">👑 Super Admin</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-xs text-white/50 font-myanmar">Role ပြောင်းရန်:</span>
                    <select 
                      value={u.role === 'user' ? 'member' : (u.role || 'member')}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={!isSuperAdmin || u.id === user?.id || (u.role === 'super_admin' && superAdminCount <= 1)}
                      title={
                        !isSuperAdmin ? 'Role ပြောင်းရန် Super Admin သာ ခွင့်ရှိသည်'
                        : u.id === user?.id ? 'ကိုယ့်ရဲ့ Role ကို ကိုယ်တိုင်ပြောင်းလို့မရပါ'
                        : u.role === 'super_admin' && superAdminCount <= 1 ? 'နောက်ဆုံး Super Admin ဖြစ်နေလို့ ပြောင်းလို့မရပါ'
                        : ''
                      }
                      className={`text-xs px-2 py-1.5 rounded-lg border outline-none font-bold disabled:opacity-60 ${
                        u.role === 'admin' ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' :
                        u.role === 'moderator' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' :
                        u.role === 'super_admin' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' :
                        'bg-white/5 border-white/10 text-white/60'
                      }`}
                      style={{ backgroundColor: '#1a0030' }}
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  {/* Donation permission — Admin-granted, moderators only */}
                  {isAdmin && u.role === 'moderator' && (
                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                      <span className="text-xs text-white/50 font-myanmar">အလှူငွေ ပြင်ခွင့်:</span>
                      <button
                        onClick={() => handleDonationPermission(u, !u.can_manage_donations)}
                        disabled={donationBusy === u.id}
                        className={`flex items-center gap-2 text-xs font-bold disabled:opacity-50 ${u.can_manage_donations ? 'text-green-400' : 'text-white/60'}`}
                        title={u.can_manage_donations ? 'အလှူငွေ ပြင်ခွင့် ပေးထားသည် — နှိပ်လျှင် ရုပ်သိမ်းမည်' : 'အလှူငွေ ပြင်ခွင့် မပေးထားပါ — နှိပ်လျှင် ပေးမည်'}
                      >
                        {u.can_manage_donations ? '✓ ခွင့်ပြုထားသည်' : '○ ခွင့်မပြုပါ'}
                        <span className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${u.can_manage_donations ? 'bg-green-500' : 'bg-white/15'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${u.can_manage_donations ? 'left-[22px]' : 'left-0.5'}`} />
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            {usersHasMore && !loading && (
              <button onClick={() => setUsersLimit(l => l + 50)} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-xs font-bold">ထပ်တင်ရန် • Load more</button>
            )}
          </div>
        </div>
      )}

      {tab === 'claims' && (
        <div className="px-4 space-y-2 animate-fade-in">
          {claimsLoading ? (
            <p className="text-white/60 text-center py-8">Loading claims...</p>
          ) : claims.length === 0 ? (
            <p className="text-white/60 text-center py-8 font-myanmar">စစ်ဆေးဆဲ ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်း မရှိပါ</p>
          ) : (
            claims.map(claim => (
              <div key={claim.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{claim.listing?.name_mm || claim.listing?.name || '—'}</p>
                    <p className="text-[11px] text-white/50 font-myanmar mt-0.5">
                      တောင်းဆိုသူ: {claim.claimant?.full_name || claim.claimant?.nickname || '—'}
                      {claim.contact_phone ? ` • ${claim.contact_phone}` : ''}
                    </p>
                    {claim.note && <p className="text-xs text-white/60 font-myanmar mt-1">💬 {claim.note}</p>}
                    <p className="text-[10px] text-white/60 mt-1">{formatMyanmarDate(claim.created_at, { year: true })}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-amber-500/20 border-amber-500/30 text-amber-400 flex-shrink-0">PENDING</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleClaimDecision(claim, true)}
                    disabled={claimBusy === claim.id}
                    className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Check size={12} /> {claimBusy === claim.id ? '...' : 'APPROVE (+30 အမှတ်)'}
                  </button>
                  <button
                    onClick={() => handleClaimDecision(claim, false)}
                    disabled={claimBusy === claim.id}
                    className="flex-1 px-3 py-2 bg-white/8 border border-white/10 text-white/60 rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <X size={12} /> REJECT
                  </button>
                  <button onClick={() => navigate(`/directory/${claim.listing_id}`)} className="px-3 py-2 bg-white/5 border border-white/10 text-white/50 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                    <Eye size={12} /> VIEW
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div className="animate-fade-in -mt-4">
          <CategoryManagerPage />
        </div>
      )}

      {tab === 'quicklinks' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="card-dark p-4 rounded-2xl border border-white/10 space-y-3 relative">
            <h3 className="text-sm font-bold text-white mb-2">{editingLink ? '✏️ Edit Link' : '➕ Add New Link'}</h3>
            
            <div className="mb-3">
              <label className="text-[10px] text-white/50 mb-1.5 block font-myanmar">အမြန်ရွေးချယ်ရန် (Template)</label>
              <select 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val !== 'custom') {
                    const preset = PRESET_LINKS.find(p => p.url === val);
                    setLinkForm({
                      ...linkForm,
                      title: preset.title,
                      title_mm: preset.title_mm,
                      subtitle: preset.subtitle,
                      icon: preset.icon,
                      url: preset.url,
                      css_classes: preset.css
                    });
                  } else if (val === 'custom') {
                    setLinkForm({...linkForm, url: ''});
                  }
                  e.target.value = '';
                }}
                className="input-dark w-full font-myanmar bg-white/5 border border-white/20"
                style={{ backgroundColor: '#1a0030' }}
              >
                {PRESET_LINKS.map(p => <option key={p.url || 'none'} value={p.url}>{p.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-3">
              <input value={linkForm.title} onChange={e => setLinkForm({...linkForm, title: e.target.value})} placeholder="Title (EN)" className="input-dark" />
              <input value={linkForm.title_mm} onChange={e => setLinkForm({...linkForm, title_mm: e.target.value})} placeholder="Title (MM)" className="input-dark font-myanmar" />
              <input value={linkForm.subtitle} onChange={e => setLinkForm({...linkForm, subtitle: e.target.value})} placeholder="Subtitle" className="input-dark" />
              <div className="flex gap-2">
                <input value={linkForm.icon} onChange={e => setLinkForm({...linkForm, icon: e.target.value})} placeholder="Icon" className="input-dark w-12 text-center" />
                <input value={linkForm.url} onChange={e => setLinkForm({...linkForm, url: e.target.value})} placeholder="URL" className="input-dark flex-1" />
              </div>
              <input value={linkForm.css_classes} onChange={e => setLinkForm({...linkForm, css_classes: e.target.value})} placeholder="CSS classes" className="input-dark col-span-2" />
              <div className="flex items-center gap-2 col-span-2">
                <label className="text-xs text-white/60">Sort Order:</label>
                <input type="number" value={linkForm.sort_order} onChange={e => setLinkForm({...linkForm, sort_order: e.target.value})} className="input-dark w-16 text-center" />
                <label className="flex items-center gap-2 text-xs text-white/60 ml-4 cursor-pointer">
                  <input type="checkbox" checked={linkForm.is_active} onChange={e => setLinkForm({...linkForm, is_active: e.target.checked})} className="w-4 h-4" />
                  Active
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveLink} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 rounded-xl transition-colors">
                {editingLink ? 'Update' : 'Save Link'}
              </button>
              {editingLink && (
                <button onClick={() => { setEditingLink(null); setLinkForm({ title: '', title_mm: '', subtitle: '', icon: '🔗', url: '', css_classes: 'bg-white/5 border-white/10 text-white hover:bg-white/8', sort_order: 0, is_active: true }) }} 
                  className="flex-1 bg-white/10 text-white/50 text-xs font-bold py-2.5 rounded-xl hover:bg-white/20 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {linkLoading ? (
              <p className="text-xs text-white/60 text-center py-4">Loading...</p>
            ) : quickLinks.length === 0 ? (
              <p className="text-xs text-white/60 text-center py-4">Link များ မရှိသေးပါ</p>
            ) : (
              quickLinks.map(link => (
                <div key={link.id} className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${link.is_active ? 'bg-white/5 border-white/10' : 'bg-white/5 border-white/10 opacity-50'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{link.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{link.title_mm || link.title}</p>
                      <p className="text-[10px] text-white/60">{link.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-black/30 px-2 py-1 rounded-lg text-white/60 mr-2">Sort: {link.sort_order}</span>
                    <button onClick={() => { setEditingLink(link.id); setLinkForm(link) }} className="w-8 h-8 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDeleteLink(link.id)} className="w-8 h-8 flex items-center justify-center btn-danger rounded-xl">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'listings' && (
        <div className="animate-fade-in">
          <div className="px-4 mb-4 flex gap-2 flex-wrap">
            {[['all', 'All'], ['approved', 'Approved'], ['pending', 'Pending'], ['suspended', 'Suspended']].map(([val, label]) => (
              <button key={val} onClick={() => setListingFilter(val)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  listingFilter === val
                    ? 'bg-blue-600/30 border-blue-400/40 text-blue-200'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}>
                {label}
                {val === 'pending' && pendingListingsCount > 0 && listingFilter !== 'pending' && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-[8px] text-white">
                    {pendingListingsCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="px-4 space-y-2">
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(n => <div key={n} className="h-24 rounded-2xl shimmer" />)}
              </div>
            ) : data.length === 0 ? (
              <p className="text-white/60 text-center py-8">No listings found</p>
            ) : (
              data.map(item => (
                <div key={item.id} className="bg-white/5 border border-white/8 rounded-2xl p-4">
                  {editingId === item.id ? (
                    <div className="space-y-3">
                      <p className="text-[10px] text-white/50 font-myanmar">လုပ်ငန်းအမည် * (မြန်မာ သို့မဟုတ် English တစ်ခု)</p>
                      <input value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white" placeholder="Name" />
                      <input value={editForm.name_mm || ''} onChange={e => setEditForm({...editForm, name_mm: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white font-myanmar" placeholder="Name (Myanmar)" />
                      <textarea value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white" placeholder="Description" rows="3" />
                      <textarea value={editForm.description_mm || ''} onChange={e => setEditForm({...editForm, description_mm: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white font-myanmar" placeholder="ဖော်ပြချက် (မြန်မာ)" rows="3" />
                      <input value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white" placeholder="Address" />
                      <div className="flex gap-2">
                        <input value={editForm.city || ''} onChange={e => setEditForm({...editForm, city: e.target.value})} className="flex-1 min-w-0 bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white font-myanmar" placeholder="မြို့" />
                        <input value={editForm.township || ''} onChange={e => setEditForm({...editForm, township: e.target.value})} className="flex-1 min-w-0 bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white font-myanmar" placeholder="မြို့နယ်" />
                      </div>
                      <input value={editForm.phone_1 || ''} onChange={e => setEditForm({...editForm, phone_1: e.target.value})} className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white" placeholder="Phone" />
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(item.id)} disabled={editSaving} className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"><Save size={14} /> {editSaving ? '...' : 'SAVE'}</button>
                        <button onClick={() => setEditingId(null)} disabled={editSaving} className="flex-1 px-3 py-2 bg-white/8 text-white/60 rounded-lg text-xs font-bold disabled:opacity-50">CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{item.name_mm || item.name}</p>
                          <p className="text-[10px] text-white/60">{item.category?.name_mm || item.category?.name} • {item.city}</p>
                          <p className="text-[10px] text-white/60 mt-0.5">{item.address}</p>
                          {item.submitter && <p className="text-[9px] text-white/60 mt-0.5">တင်သွင်းသူ: {item.submitter.full_name}</p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex-shrink-0 ${
                          item.status === 'approved' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                          item.status === 'suspended' ? 'bg-red-500/20   border-red-500/30   text-red-400' :
                                                       'bg-amber-500/20 border-amber-500/30 text-amber-400'
                        }`}>{item.status.toUpperCase()}</span>
                      </div>

                      {reports[item.id] > 0 && (
                        <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                          <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><AlertCircle size={12} /> {reports[item.id]} Reports</span>
                          <button onClick={() => navigate('/admin/reports')} className="text-[9px] text-red-400 hover:text-red-300">
                            ကြည့်မည်
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                        {item.status !== 'approved' && (
                          <button onClick={() => handleApprove(item.id)} disabled={listingBusy === item.id} className="flex-1 min-w-[70px] px-3 py-2.5 bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                            <Check size={12} /> {listingBusy === item.id ? '...' : 'APPROVE 🍒'}
                          </button>
                        )}
                        {item.status === 'approved' && (
                          <button onClick={() => handleSuspend(item.id)} disabled={listingBusy === item.id} className="flex-1 min-w-[70px] px-3 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                            <X size={12} /> {listingBusy === item.id ? '...' : 'SUSPEND'}
                          </button>
                        )}
                        <button onClick={() => handleEdit(item)} className="flex-1 min-w-[60px] px-3 py-2.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                          <Pencil size={12} /> EDIT
                        </button>
                        <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id} className="flex-1 min-w-[70px] px-3 py-2.5 btn-danger rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                          <Trash2 size={12} /> {deleting === item.id ? '...' : 'DELETE'}
                        </button>
                        <button onClick={() => navigate(`/directory/${item.id}`)} className="flex-1 min-w-[55px] px-3 py-2.5 bg-white/5 border border-white/10 text-white/50 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                          <Eye size={12} /> VIEW
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
            {listingsHasMore && !loading && (
              <button onClick={() => setListingsLimit(l => l + 50)} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-xs font-bold">ထပ်တင်ရန် • Load more</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component for stat cards
function StatCard({ title, value, icon: Icon, color, pulse = false, size = 'normal' }) {
  return (
    <div className="card-dark p-3 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between">
        <div>
          <p className={`${size === 'small' ? 'text-[9px]' : 'text-[10px]'} text-white/60 uppercase tracking-wider font-bold`}>{title}</p>
          <p className={`font-display font-bold ${size === 'small' ? 'text-lg' : 'text-xl'} text-white`}>{value.toLocaleString()}</p>
        </div>
        <Icon size={size === 'small' ? 16 : 20} className={`${color} ${pulse ? 'animate-pulse' : ''}`} />
      </div>
    </div>
  )
}
