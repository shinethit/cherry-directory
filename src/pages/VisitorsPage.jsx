import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye } from 'lucide-react'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { fetchVisitStats } from '../lib/prefetch'
import { formatPeakHour, devicePercentages } from '../lib/visitTracking'

// Visitors dashboard — v9.12 (public, no login needed).
// Data comes ONLY from the get_visit_stats RPC (aggregates). Raw visit
// rows are never exposed to the client, and no personal data is ever
// shown — totals, percentages, top countries and peak hours only.
// Counts start at ZERO when 9.12 ships (no visits were recorded before),
// so small numbers at first are real, not broken. If the 9.12 migration
// has not been run yet, the RPC fails and this page shows "—".
function last14Days(daily) {
  const byDate = {}
  for (const d of daily || []) byDate[d.date] = Number(d.count) || 0
  const out = []
  // N29 (v9.17): dates in Asia/Rangoon, matching the RPC grouping — the
  // device timezone can be on a different day than Yangon.
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Rangoon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (t) => Number(parts.find(p => p.type === t).value)
  const today = new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, count: byDate[key] || 0 })
  }
  return out
}

function hourArray(byHour) {
  const arr = new Array(24).fill(0)
  for (let h = 0; h < 24; h++) arr[h] = Number(byHour?.[String(h)]) || 0
  return arr
}

export default function VisitorsPage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'လာကြည့်သူများ' : 'Visitors' })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statsError, setStatsError] = useState(false)

  // Issue 4c (v9.17): useQuery ['visit-stats'] (same fetcher as the
  // prefetch runner), so the stats render from cache instantly on
  // revisit under VPN.
  // V1 (v9.20): the query error was ignored (isError unused) — an RPC
  // failure was indistinguishable from "no data yet" and had no retry.
  const { data: statsData, isLoading: statsQueryLoading, isError: statsQueryError, refetch: refetchStats } = useQuery({
    queryKey: ['visit-stats'],
    queryFn: fetchVisitStats,
  })
  useEffect(() => {
    if (statsData) { setStats(statsData); setStatsError(false) }
    if (statsQueryError) setStatsError(true)
    setLoading(statsQueryLoading)
  }, [statsData, statsQueryLoading, statsQueryError])

  const total = Number(stats?.total) || 0
  const pct = devicePercentages(stats?.by_device, total)
  const days = last14Days(stats?.daily)
  const maxDay = Math.max(0, ...days.map((d) => d.count))
  const hours = hourArray(stats?.by_hour)
  const maxHour = Math.max(0, ...hours)
  const peak = formatPeakHour(stats?.by_hour)
  const topCountry = stats?.by_country?.[0] || null
  const num = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString())
  const show = (v) => (loading ? '…' : stats === null ? '—' : num(v))

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div>
          <h1 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <Eye size={18} className="text-brand-400" />
            {lang === 'mm' ? 'လာကြည့်သူများ' : 'Visitors'}
          </h1>
          <p className="text-[10px] text-white/50 font-myanmar">
            {lang === 'mm' ? 'Data အစစ် — အရေအတွက်သာ (ကိုယ်ရေးအချက်အလက် မပါ)' : 'Real data — counts only (no personal data)'}
          </p>
        </div>
      </div>

      {stats === null && !loading && statsError && (
        <div className="px-4 mb-4">
          <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
            <p className="text-sm text-red-400 font-myanmar">လာကြည့်သူ Data ရယူမရပါ</p>
            <button onClick={() => { setStatsError(false); refetchStats() }} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
          </div>
        </div>
      )}

      {stats === null && !loading && !statsError && (
        <div className="px-4 mb-4">
          <div className="card-dark rounded-2xl p-4 text-center">
            <p className="text-sm text-white/60 font-myanmar">
              {lang === 'mm' ? 'လာကြည့်သူ Data မရှိသေးပါ' : 'No visitor data yet'}
            </p>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            { labelMm: 'စုစုပေါင်း', labelEn: 'Total', value: stats?.total },
            { labelMm: 'ဒီနေ့', labelEn: 'Today', value: stats?.today },
            { labelMm: 'ဒီအပတ်', labelEn: 'This week', value: stats?.week },
            { labelMm: 'ဒီလ', labelEn: 'This month', value: stats?.month },
          ].map((s) => (
            <div key={s.labelEn} className="card-dark rounded-xl p-2.5 text-center min-w-0">
              <p className="font-display font-bold text-base text-white leading-none truncate">{show(s.value)}</p>
              <p className="text-[9px] text-white/50 font-myanmar mt-1">{lang === 'mm' ? s.labelMm : s.labelEn}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily visits — last 14 days (plain div bars, no chart dependency) */}
      <div className="px-4 mb-4">
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <p className="font-display font-bold text-sm text-white">
            {lang === 'mm' ? 'နေ့စဉ် လာကြည့်သူ (နောက်ဆုံး ၁၄ ရက်)' : 'Daily visits (last 14 days)'}
          </p>
          <div className="flex items-end gap-1 h-24">
            {days.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0" title={`${d.date}: ${d.count}`}>
                <span className="text-[8px] text-white/60 font-display leading-none">{d.count > 0 ? d.count : ''}</span>
                <div
                  className="w-full rounded-t bg-brand-500/80"
                  style={{ height: `${maxDay > 0 ? Math.max(d.count > 0 ? 4 : 0, (d.count / maxDay) * 64) : 0}px` }}
                />
                <span className="text-[8px] text-white/40 leading-none">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Device breakdown */}
      <div className="px-4 mb-4">
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <p className="font-display font-bold text-sm text-white">
            {lang === 'mm' ? 'ဘာ Device နဲ့ ကြည့်လဲ' : 'Devices used'}
          </p>
          {[
            { key: 'phone', icon: '📱', labelMm: 'ဖုန်း', labelEn: 'Phone', count: Number(stats?.by_device?.phone) || 0 },
            { key: 'tablet', icon: '📟', labelMm: 'Tablet', labelEn: 'Tablet', count: Number(stats?.by_device?.tablet) || 0 },
            { key: 'desktop', icon: '💻', labelMm: 'ကွန်ပျူတာ', labelEn: 'Computer', count: Number(stats?.by_device?.desktop) || 0 },
          ].map((row) => (
            <div key={row.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70 font-myanmar">{row.icon} {lang === 'mm' ? row.labelMm : row.labelEn}</span>
                <span className="text-white/50 font-display">{stats === null ? '—' : `${row.count.toLocaleString()} (${pct[row.key]}%)`}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct[row.key]}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Country breakdown — top 5 */}
      <div className="px-4 mb-4">
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <p className="font-display font-bold text-sm text-white">
            {lang === 'mm' ? 'ဘယ်နိုင်ငံက ကြည့်လဲ' : 'Countries'}
          </p>
          {stats === null ? (
            <p className="text-xs text-white/50 font-myanmar">—</p>
          ) : (stats.by_country || []).length === 0 ? (
            <p className="text-xs text-white/50 font-myanmar">
              {lang === 'mm' ? 'နိုင်ငံ Data မရှိသေးပါ' : 'No country data yet'}
            </p>
          ) : (
            (stats.by_country || []).map((c) => (
              <div key={c.code} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70 font-myanmar">{c.name || c.code}</span>
                  <span className="text-white/50 font-display">
                    {Number(c.count).toLocaleString()} ({total > 0 ? Math.round((Number(c.count) / total) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${total > 0 ? Math.round((Number(c.count) / total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Peak hours — 24-hour strip */}
      <div className="px-4 mb-4">
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <p className="font-display font-bold text-sm text-white">
            {lang === 'mm' ? 'ဘယ်အချိန် အကြည့်များလဲ' : 'When do people visit'}
          </p>
          <p className="text-xs text-white/60 font-myanmar">
            {stats === null
              ? '—'
              : peak
                ? `${lang === 'mm' ? 'အကြည့်များဆုံးအချိန်: ' : 'Peak time: '}${peak}`
                : (lang === 'mm' ? 'Data မရှိသေးပါ' : 'No data yet')}
          </p>
          <div className="flex items-end gap-[2px] h-16">
            {hours.map((c, h) => {
              const isPeak = peak !== null && c === maxHour && c > 0 && h === hours.indexOf(maxHour)
              return (
                <div
                  key={h}
                  className={`flex-1 rounded-t ${isPeak ? 'bg-brand-400' : 'bg-white/25'}`}
                  style={{ height: `${maxHour > 0 ? Math.max(c > 0 ? 3 : 0, (c / maxHour) * 48) : 0}px` }}
                  title={`${h}:00 — ${c}`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[9px] text-white/40 font-display">
            <span>0</span><span>6</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>
      </div>

      {/* Honest note */}
      <div className="px-4">
        <div className="card-dark rounded-2xl p-4 text-center">
          <p className="text-xs text-white/50 font-myanmar leading-relaxed">
            {lang === 'mm'
              ? 'နံပါတ်တွေက 9.12 ဗားရှင်းက စပြီး ရေတွက်ထားတာပါ — အတိတ်ကို ပြန်ဖြည့်မရပါ။ IP၊ နာမည်၊ ကိုယ်ရေးအချက်အလက် ဘာမှ မသိမ်းပါ။'
              : 'Counts started with v9.12 — past visits cannot be backfilled. No IP, names, or personal data is stored.'}
          </p>
        </div>
      </div>
    </div>
  )
}
