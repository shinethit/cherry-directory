import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Download, CheckCircle, XCircle, FileSpreadsheet, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'
import { useAuditLog } from '../hooks/useAuditLog'
import { showError, showSuccess } from '../lib/toast'

const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2MB

const COLUMNS = [
  { key: 'name',         label: 'name',         required: true,  example: 'Golden Palace Restaurant' },
  { key: 'name_mm',      label: 'name_mm',       required: false, example: 'ဂိုလ်ဒင်ပဲလက် စားသောက်ဆိုင်' },
  { key: 'category',     label: 'category',      required: true,  example: 'Restaurant & Food' },
  { key: 'city',         label: 'city',          required: false, example: 'Taunggyi' },
  { key: 'township',     label: 'township',      required: false, example: 'Aung Chan Tha' },
  { key: 'ward',         label: 'ward',          required: false, example: 'ဗိုလ်ချုပ်ရပ်ကွက်' },
  { key: 'address_mm',   label: 'address_mm',    required: false, example: 'ဗိုလ်ချုပ်လမ်း' },
  { key: 'phone_1',      label: 'phone_1',       required: false, example: '09123456789' },
  { key: 'phone_2',      label: 'phone_2',       required: false, example: '' },
  { key: 'viber',        label: 'viber',         required: false, example: '09123456789' },
  { key: 'telegram',     label: 'telegram',      required: false, example: '@handle' },
  { key: 'whatsapp',     label: 'whatsapp',      required: false, example: '09123456789' },
  { key: 'facebook',     label: 'facebook',      required: false, example: 'https://facebook.com/...' },
  { key: 'description_mm', label: 'description_mm', required: false, example: 'ဖော်ပြချက်...' },
  { key: 'latitude',     label: 'latitude',      required: false, example: '20.7856' },
  { key: 'longitude',    label: 'longitude',     required: false, example: '97.0364' },
]

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.replace(/\r/g, ''))
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const values = []
    let inQuote = false, cur = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    values.push(cur.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
  })
  return { headers, rows }
}

function generateTemplate() {
  const header = COLUMNS.map(c => c.key).join(',')
  const example = COLUMNS.map(c => '"' + c.example + '"').join(',')
  const blob = new Blob([header + '\n' + example], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'cherry-directory-import-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

// Normalize a phone to digits only (Myanmar digits ၀-၉ → 0-9 first)
// so '09 123' and '၀၉၁၂၃' dedupe to the same key.
const MY_DIGITS = { '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4', '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9' }
function normPhone(p) {
  return (p || '').replace(/[၀-၉]/g, d => MY_DIGITS[d]).replace(/\D/g, '')
}

function dedupeKey(name, phone) {
  return (name || '').trim().toLowerCase() + '|' + normPhone(phone)
}

export default function BulkImportPage() {
  const navigate = useNavigate()
  const { profile, isAdmin, isModerator, loading: authLoading } = useAuth()
  const { log } = useAuditLog()
  useSEO({ title: 'Bulk Import' })

  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [results, setResults] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    supabase.from('categories').select('*').eq('type', 'directory').then(({ data, error }) => {
      if (error) {
        console.warn('Failed to load categories for import:', error)
        return
      }
      setCategories(data || [])
    })
  }, [])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      showError('ဖိုင် အရွယ်အစား 2MB ထက် မကျော်ရပါ')
      e.target.value = ''
      return
    }
    setFileName(file.name)
    setResults(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result)
      setPreview(parsed)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    if (!preview?.rows?.length) return
    if (!profile?.id) {
      showError('Login ဝင်ပြီးမှ Import လုပ်နိုင်သည်')
      return
    }
    setImporting(true)
    setProgress(0)

    const batchId = crypto.randomUUID()
    let success = 0, failed = 0
    let errors = []
    let skipped = []

    const catMap = {}
    categories.forEach(c => {
      if (c.name) catMap[c.name.toLowerCase().trim()] = c.id
      if (c.name_mm) catMap[c.name_mm.trim()] = c.id
    })

    const { data: importRec, error: importRecError } = await supabase.from('bulk_imports').insert({
      user_id: profile.id,
      file_name: fileName,
      row_total: preview.rows.length,
      status: 'processing',
    }).select().single()

    // The bulk_imports insert can fail (e.g. RLS) — without a batch
    // record there is nothing to update later, so stop honestly
    // instead of crashing on importRec.id.
    if (importRecError || !importRec) {
      showError('Import မှတ်တမ်း ဖန်တီးမရပါ: ' + (importRecError?.message || 'unknown error'))
      setImporting(false)
      return
    }

    // Dedupe set: existing listings (name + normalized phone) plus
    // rows already accepted from this file.
    const seenKeys = new Set()
    try {
      const { data: existing } = await supabase.from('listings').select('name, phone_1')
      ;(existing || []).forEach(l => seenKeys.add(dedupeKey(l.name, l.phone_1)))
    } catch (e) {
      console.warn('Dedupe lookup failed — file-only dedupe:', e)
    }

    const BATCH_SIZE = 20;
    const totalRows = preview.rows.length;
    
    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const chunk = preview.rows.slice(i, i + BATCH_SIZE);
      const inserts = [];

      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        const rowNum = i + j + 2;
        
        if (!row.name?.trim()) {
          errors.push({ row: rowNum, field: 'name', message: 'Name is required' });
          failed++;
          continue;
        }

        const catId = catMap[row.category?.toLowerCase().trim()] || catMap[row.category?.trim()] || null;
        if (!catId && row.category) {
          // Category not found → error list, never inserted as success.
          errors.push({ row: rowNum, field: 'category', message: 'Category "' + row.category + '" not found' });
          failed++;
          continue;
        }

        const key = dedupeKey(row.name, row.phone_1)
        if (seenKeys.has(key)) {
          skipped.push({ row: rowNum, field: 'duplicate', message: '"' + row.name.trim() + '" ထပ်နေသည် — ကျော်လိုက်သည်' });
          continue;
        }
        seenKeys.add(key)

        inserts.push({
          record: {
            name: row.name.trim(),
            name_mm: row.name_mm?.trim() || null,
            description_mm: row.description_mm?.trim() || null,
            category_id: catId,
            city: row.city?.trim() || 'Taunggyi',
            township: row.township?.trim() || null,
            ward: row.ward?.trim() || null,
            address_mm: row.address_mm?.trim() || null,
            phone_1: row.phone_1?.trim() || null,
            phone_2: row.phone_2?.trim() || null,
            viber: row.viber?.trim() || null,
            telegram: row.telegram?.trim() || null,
            whatsapp: row.whatsapp?.trim() || null,
            facebook: row.facebook?.trim() || null,
            latitude: row.latitude ? parseFloat(row.latitude) : null,
            longitude: row.longitude ? parseFloat(row.longitude) : null,
            submitted_by: profile.id,
            // Imported rows go to the admin approve queue, never live.
            status: 'pending',
          },
          rowNum,
        });
      }

      // One bad row must not fail the whole chunk — insert per row
      // and report each result separately.
      if (inserts.length > 0) {
        const settled = await Promise.allSettled(
          inserts.map(({ record }) => supabase.from('listings').insert(record))
        )
        settled.forEach((res, idx) => {
          const rowNum = inserts[idx].rowNum
          if (res.status === 'fulfilled' && !res.value.error) {
            success++
          } else {
            const msg = res.status === 'rejected'
              ? (res.reason?.message || String(res.reason))
              : (res.value.error?.message || 'Insert failed')
            errors.push({ row: rowNum, field: '-', message: msg })
            failed++
          }
        })
      }
      
      setProgress(Math.round(((i + chunk.length) / totalRows) * 100));
      // delay to avoid rate limit
      await new Promise(r => setTimeout(r, 500));
    }

    const { error: updateErr } = await supabase.from('bulk_imports').update({
      row_success: success, row_failed: failed,
      errors, status: failed === totalRows ? 'failed' : 'done',
    }).eq('id', importRec.id)
    if (updateErr) console.warn('Failed to update bulk_imports record:', updateErr)

    const logged = await log({
      action: 'bulk_import',
      table: 'listings',
      name: fileName,
      meta: { batch_id: batchId, total: totalRows, success, failed, skipped: skipped.length },
    })
    if (!logged) console.warn('Audit log failed for bulk import')

    setResults({ success, failed, errors, skipped, total: totalRows })
    setImporting(false)
    if (success > 0) showSuccess(`✓ ${success} ခု Import ပြီးပါပြီ (Admin အတည်ပြုရန် စောင့်ဆိုင်းနေသည်)`)
  }

  // Admin/mod-only: guests (profile === null) used to crash at
  // profile.id. Wait for auth, then show a lock screen.
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh] px-8 text-center">
        <p className="text-white/50 font-myanmar">စစ်ဆေးနေသည်...</p>
      </div>
    )
  }

  if (!isAdmin && !isModerator) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] px-8 text-center gap-3">
        <Lock size={32} className="text-white/30" />
        <p className="text-white/50 font-myanmar">🔒 Admin / Moderator သာ Import လုပ်နိုင်သည်</p>
        <button onClick={() => navigate('/')} className="btn-primary text-xs px-4 py-2">Home ပြန်မည်</button>
      </div>
    )
  }

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div>
          <h1 className="font-display font-bold text-lg text-white">Bulk Import</h1>
          <p className="text-[10px] text-white/40">CSV ဖြင့် လုပ်ငန်းများ တစ်ပြိုင်တည်း ထည့်သွင်းမည်</p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600/40 text-brand-300 text-xs font-bold flex items-center justify-center">1</span>
            <p className="text-sm font-display font-semibold text-white">Template ဒေါင်းလုတ်လုပ်ပါ</p>
          </div>
          <button onClick={generateTemplate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600/20 border border-brand-400/30 text-brand-300 text-sm hover:bg-brand-600/30 transition-colors">
            <Download size={15} /> Template CSV ဒေါင်းလုတ်
          </button>
        </div>

        <div className="card-dark rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600/40 text-brand-300 text-xs font-bold flex items-center justify-center">2</span>
            <p className="text-sm font-display font-semibold text-white">CSV ဖိုင် ရွေးချယ်ပါ (အများဆုံး 2MB)</p>
          </div>

          <label
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center h-28 rounded-2xl border-2 border-dashed border-white/15 hover:border-brand-400/40 cursor-pointer transition-colors"
          >
            {fileName ? (
              <>
                <FileSpreadsheet size={28} className="text-brand-300 mb-2" />
                <p className="text-sm text-white/70 font-semibold">{fileName}</p>
                <p className="text-xs text-white/40 mt-0.5">{preview?.rows?.length || 0} rows detected</p>
              </>
            ) : (
              <>
                <Upload size={28} className="text-white/20 mb-2" />
                <p className="text-sm text-white/40">CSV ဖိုင် ရွေးချယ်ရန် နှိပ်ပါ</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>
        </div>

        {preview && preview.rows.length > 0 && !results && (
          <div className="card-dark rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-display font-semibold text-white">Preview</p>
              <span className="badge bg-brand-700/60 text-brand-200">{preview.rows.length} rows</span>
            </div>

            <button onClick={handleImport} disabled={importing} className="btn-primary w-full text-sm flex items-center justify-center gap-2 relative overflow-hidden">
              {importing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> 
                  Import လုပ်နေသည်... {progress}%
                  <div className="absolute bottom-0 left-0 h-1 bg-white/30 transition-all" style={{ width: progress + '%' }} />
                </>
              ) : (
                <><Upload size={15} /> {preview.rows.length} လုပ်ငန်း Import လုပ်မည်</>
              )}
            </button>
          </div>
        )}

        {results && (
          <div className="card-dark rounded-2xl p-4 space-y-4">
            <p className="text-sm font-display font-bold text-white">Import ပြီးပါပြီ</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="font-display font-bold text-xl text-white">{results.total}</p>
                <p className="text-[9px] text-white/40">Total</p>
              </div>
              <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
                <p className="font-display font-bold text-xl text-green-400">{results.success}</p>
                <p className="text-[9px] text-green-400/60">Success</p>
              </div>
              <div className={'rounded-xl p-3 text-center border ' + (results.failed > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5')}>
                <p className={'font-display font-bold text-xl ' + (results.failed > 0 ? 'text-red-400' : 'text-white/30')}>{results.failed}</p>
                <p className={'text-[9px] ' + (results.failed > 0 ? 'text-red-400/60' : 'text-white/20')}>Failed</p>
              </div>
              <div className={'rounded-xl p-3 text-center border ' + (results.skipped.length > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/5')}>
                <p className={'font-display font-bold text-xl ' + (results.skipped.length > 0 ? 'text-amber-400' : 'text-white/30')}>{results.skipped.length}</p>
                <p className={'text-[9px] ' + (results.skipped.length > 0 ? 'text-amber-400/60' : 'text-white/20')}>Skipped</p>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                <p className="text-xs text-red-400 font-display font-semibold">Errors ({results.errors.length})</p>
                {results.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-red-300/80">
                    <XCircle size={12} className="flex-shrink-0 mt-0.5" />
                    <span>Row {e.row}: {e.message}</span>
                  </div>
                ))}
              </div>
            )}

            {results.skipped.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                <p className="text-xs text-amber-400 font-display font-semibold">Skipped — ထပ်နေလို့ ကျော်လိုက်သည် ({results.skipped.length})</p>
                {results.skipped.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-amber-300/80">
                    <CheckCircle size={12} className="flex-shrink-0 mt-0.5" />
                    <span>Row {e.row}: {e.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => navigate('/directory')} className="btn-primary flex-1 text-sm">Directory ကြည့်မည်</button>
              <button onClick={() => { setPreview(null); setResults(null); setFileName(''); setProgress(0) }} className="btn-ghost flex-1 text-sm">ထပ် Import လုပ်မည်</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
