import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Download, CheckCircle, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'
import { useAuditLog } from '../hooks/useAuditLog'

// Expected CSV columns
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
    // Handle quoted commas
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
  const example = COLUMNS.map(c => `"${c.example}"`).join(',')
  const blob = new Blob([header + '\n' + example], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'cherry-directory-import-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function BulkImportPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { log } = useAuditLog()
  useSEO({ title: 'Bulk Import' })

  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)   // { headers, rows }
  const [fileName, setFileName] = useState('')
  const [results, setResults] = useState(null)   // { success, failed, errors }
  const [importing, setImporting] = useState(false)
  const [categories, setCategories] = useState([])

  useState(() => {
    supabase.from('categories').select('*').eq('type', 'directory').then(({ data }) => setCategories(data || []))
  }, [])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
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
    setImporting(true)

    const batchId = crypto.randomUUID()
    let success = 0, failed = 0, errors = []

    // Fetch categories map
    const catMap = {}
    categories.forEach(c => {
      catMap[c.name.toLowerCase().trim()] = c.id
      if (c.name_mm) catMap[c.name_mm.trim()] = c.id
      // Also map common aliases
      if (c.name_en) catMap[c.name_en.toLowerCase().trim()] = c.id
    })

    // Insert bulk_import record
    const { data: importRec } = await supabase.from('bulk_imports').insert({
      user_id: profile.id,
      file_name: fileName,
      row_total: preview.rows.length,
      status: 'processing',
    }).select().single()

    for (let i = 0; i < preview.rows.length; i++) {
      const row = preview.rows[i]
      const rowNum = i + 2  // +2: header + 1-indexed

      if (!row.name?.trim()) {
        errors.push({ row: rowNum, field: 'name', message: 'Name is required' })
        failed++; continue
      }

      const catId = catMap[row.category?.toLowerCase().trim()] || catMap[row.category?.trim()] || null
      if (!catId && row.category) {
        errors.push({ row: rowNum, field: 'category', message: `Category "${row.category}" not found — skipping` })
      }

      const record = {
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
        status: 'approved',  // Admin bulk import = auto-approved
      }

      const { error } = await supabase.from('listings').insert(record)
      if (error) {
        errors.push({ row: rowNum, field: '-', message: error.message })
        failed++
      } else {
        success++
      }
    }

    // Update bulk_import record
    await supabase.from('bulk_imports').update({
      row_success: success, row_failed: failed,
      errors, status: failed === preview.rows.length ? 'failed' : 'done',
    }).eq('id', importRec.id)

    // Audit log
    await log({
      action: 'bulk_import',
      table: 'listings',
      name: fileName,
      meta: { batch_id: batchId, total: preview.rows.length, success, failed },
    })

    setResults({ success, failed, errors, total: preview.rows.length })
    setImporting(false)
  }

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div>
          <h1 className="font-display font-bold text-lg text-white">Bulk Import</h1>
          <p className="text-[10px] text-white/40">CSV ဖြင့် ဆိုင်များ တစ်ပြိုင်တည်း ထည့်သွင်းမည်</p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Step 1: Download template */}
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600/40 text-brand-300 text-xs font-bold flex items-center justify-center">1</span>
            <p className="text-sm font-display font-semibold text-white">Template ဒေါင်းလုတ်လုပ်ပါ</p>
          </div>
          <p className="text-xs text-white/50 font-myanmar">
            CSV template ကို ဒေါင်းလုတ်ပြီး Excel / Google Sheets ဖြင့် ဖြည့်ပါ
          </p>
          <button onClick={generateTemplate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600/20 border border-brand-400/30 text-brand-300 text-sm hover:bg-brand-600/30 transition-colors">
            <Download size={15} /> Template CSV ဒေါင်းလုတ်
          </button>

          {/* Column reference */}
          <div className="border-t border-white/8 pt-3">
            <p className="text-[10px] text-white/30 mb-2 font-display uppercase tracking-wider">Columns</p>
            <div className="space-y-1">
              {COLUMNS.map(col => (
                <div key={col.key} className="flex items-center gap-2 text-[10px]">
                  <span className={`font-mono px-1.5 py-0.5 rounded ${col.required ? 'bg-brand-600/30 text-brand-300' : 'bg-white/5 text-white/40'}`}>
                    {col.key}
                  </span>
                  {col.required && <span className="text-brand-400">required</span>}
                  {col.example && <span className="text-white/25">e.g. {col.example.slice(0, 30)}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2: Upload */}
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600/40 text-brand-300 text-xs font-bold flex items-center justify-center">2</span>
            <p className="text-sm font-display font-semibold text-white">CSV ဖိုင် ရွေးချယ်ပါ</p>
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
                <p className="text-xs text-white/20 mt-0.5">.csv only</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>
        </div>

        {/* Preview table */}
        {preview && preview.rows.length > 0 && !results && (
          <div className="card-dark rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-display font-semibold text-white">Preview</p>
              <span className="badge bg-brand-700/60 text-brand-200">{preview.rows.length} rows</span>
            </div>

            {/* Preview first 5 rows */}
            <div className="overflow-x-auto rounded-xl border border-white/8">
              <table className="w-full text-[10px] text-left">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="px-2 py-2 text-white/40 font-semibold">#</th>
                    {['name', 'category', 'city', 'phone_1'].map(h => (
                      <th key={h} className="px-2 py-2 text-white/40 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-none">
                      <td className="px-2 py-1.5 text-white/25">{i + 2}</td>
                      {['name', 'category', 'city', 'phone_1'].map(h => (
                        <td key={h} className="px-2 py-1.5 text-white/70 font-myanmar max-w-[120px] truncate">{row[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                  {preview.rows.length > 5 && (
                    <tr><td colSpan="5" className="px-2 py-1.5 text-white/25 text-center">... {preview.rows.length - 5} more rows</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <button onClick={handleImport} disabled={importing} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
              {importing ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Import လုပ်နေသည်...</>
              ) : (
                <><Upload size={15} /> {preview.rows.length} ဆိုင် Import လုပ်မည်</>
              )}
            </button>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="card-dark rounded-2xl p-4 space-y-4">
            <p className="text-sm font-display font-bold text-white">Import ပြီးပါပြီ</p>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="font-display font-bold text-xl text-white">{results.total}</p>
                <p className="text-[9px] text-white/40">Total</p>
              </div>
              <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
                <p className="font-display font-bold text-xl text-green-400">{results.success}</p>
                <p className="text-[9px] text-green-400/60">Success</p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${results.failed > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
                <p className={`font-display font-bold text-xl ${results.failed > 0 ? 'text-red-400' : 'text-white/30'}`}>{results.failed}</p>
                <p className={`text-[9px] ${results.failed > 0 ? 'text-red-400/60' : 'text-white/20'}`}>Failed</p>
              </div>
            </div>

            {results.success > 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle size={16} />
                <span className="font-myanmar">{results.success} ဆိုင် Directory ထဲ ထည့်သွင်းပြီး</span>
              </div>
            )}

            {results.errors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-red-400 font-display font-semibold">Errors ({results.errors.length})</p>
                {results.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-red-300/80">
                    <XCircle size={12} className="flex-shrink-0 mt-0.5" />
                    <span>Row {e.row} [{e.field}]: {e.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => navigate('/directory')} className="btn-primary flex-1 text-sm">Directory ကြည့်မည်</button>
              <button onClick={() => { setPreview(null); setResults(null); setFileName('') }} className="btn-ghost flex-1 text-sm">ထပ် Import လုပ်မည်</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
