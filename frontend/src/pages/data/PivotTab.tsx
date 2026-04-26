import { useState, useEffect } from 'react'
import { TrendingUp, RefreshCw, Download } from 'lucide-react'
import axios from 'axios'
import type { ParsedData, AggFunc } from './dataTypes'

interface Props { parsed: ParsedData }

interface PivotResult {
  pivot: Record<string, Record<string, number | null>>
  pivotPct: Record<string, Record<string, number | null>>
  rowKeys: string[]
  colKeys: string[]
  rowField: string
  colField: string | null
  valueField: string
  aggFunc: string
  grandTotal: Record<string, number>
}

interface FreqResult {
  field: string
  total: number
  result: { value: string; count: number; pct: number }[]
  insight: string
}

export default function PivotTab({ parsed }: Props) {
  const catCols = parsed.headers.filter(h => parsed.stats[h]?.type === 'categorical')
  const numCols = parsed.headers.filter(h => parsed.stats[h]?.type === 'numeric')

  const [mode, setMode] = useState<'freq' | 'pivot'>('freq')
  const [freqField, setFreqField] = useState(parsed.bestCatCol || catCols[0] || parsed.headers[0] || '')
  const [topN, setTopN] = useState(20)
  const [freqResult, setFreqResult] = useState<FreqResult | null>(null)
  const [freqLoading, setFreqLoading] = useState(false)

  const [pivotRow, setPivotRow] = useState(catCols[0] || parsed.headers[0] || '')
  const [pivotCol, setPivotCol] = useState('')
  const [pivotVal, setPivotVal] = useState(numCols[0] || parsed.headers[1] || '')
  const [pivotAgg, setPivotAgg] = useState<AggFunc>('count')
  const [withPct, setWithPct] = useState(true)
  const [pivotResult, setPivotResult] = useState<PivotResult | null>(null)
  const [pivotLoading, setPivotLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-run frequency on mount if cat cols exist
  useEffect(() => {
    if (freqField) runFreq()
  }, [])

  const runFreq = async () => {
    if (!freqField) return
    setFreqLoading(true); setError(''); setFreqResult(null)
    try {
      const res = await axios.post('/api/data/frequency', {
        rows: parsed.sampleForAI, field: freqField, topN
      })
      setFreqResult(res.data.data)
    } catch (e: any) { setError(e.response?.data?.error || 'Gagal hitung frekuensi') }
    finally { setFreqLoading(false) }
  }

  const runPivot = async () => {
    if (!pivotRow || !pivotVal) return
    setPivotLoading(true); setError(''); setPivotResult(null)
    try {
      const res = await axios.post('/api/data/pivot', {
        rows: parsed.sampleForAI, rowField: pivotRow,
        colField: pivotCol || null, valueField: pivotVal,
        aggFunc: pivotAgg, withPct
      })
      setPivotResult(res.data.data)
    } catch (e: any) { setError(e.response?.data?.error || 'Pivot gagal') }
    finally { setPivotLoading(false) }
  }

  const downloadCSV = () => {
    if (mode === 'freq' && freqResult) {
      const rows = [['Kategori', 'Count', 'Pct (%)'], ...freqResult.result.map(r => [r.value, r.count, r.pct])]
      triggerCSV(rows, `freq_${freqField}`)
    } else if (pivotResult) {
      const headers = [pivotResult.rowField, ...pivotResult.colKeys, 'Total']
      const rows = [headers, ...pivotResult.rowKeys.map(rk => [
        rk, ...pivotResult.colKeys.map(ck => pivotResult.pivot[rk]?.[ck] ?? ''),
        pivotResult.pivot[rk]?.['__total__'] ?? ''
      ])]
      triggerCSV(rows, `pivot_${pivotRow}`)
    }
  }

  const triggerCSV = (rows: any[][], name: string) => {
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {([['freq', '📊 Frekuensi & Persentase'], ['pivot', '🔢 Pivot Tabel']] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)',
              background: mode === m ? 'var(--accent)' : 'var(--bg-secondary)',
              color: mode === m ? '#fff' : 'var(--text-secondary)', cursor: 'pointer'
            }}>{label}</button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* Config */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'freq' ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frekuensi Otomatis</div>
              <div className="form-group">
                <label className="form-label">Kolom Kategori</label>
                <select className="form-input" value={freqField} onChange={e => setFreqField(e.target.value)}>
                  {parsed.headers.map(h => <option key={h} value={h}>{h} {parsed.stats[h]?.type === 'categorical' ? '(kat)' : '(num)'}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Top N Kategori</label>
                <input className="form-input" type="number" min={1} max={200} value={topN}
                  onChange={e => setTopN(parseInt(e.target.value) || 20)} />
              </div>
              <button className="btn btn-primary" onClick={runFreq} disabled={freqLoading || !freqField}>
                {freqLoading ? <RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <TrendingUp size={14} />}
                Hitung Frekuensi
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Konfigurasi Pivot</div>
              <div className="form-group">
                <label className="form-label">Baris (Row Field)</label>
                <select className="form-input" value={pivotRow} onChange={e => setPivotRow(e.target.value)}>
                  {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Kolom (opsional)</label>
                <select className="form-input" value={pivotCol} onChange={e => setPivotCol(e.target.value)}>
                  <option value="">— Tidak ada —</option>
                  {catCols.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nilai (Value Field)</label>
                <select className="form-input" value={pivotVal} onChange={e => setPivotVal(e.target.value)}>
                  {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Agregasi</label>
                <select className="form-input" value={pivotAgg} onChange={e => setPivotAgg(e.target.value as AggFunc)}>
                  <option value="count">COUNT</option>
                  <option value="sum">SUM</option>
                  <option value="avg">AVERAGE</option>
                  <option value="max">MAX</option>
                  <option value="min">MIN</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', marginBottom: 4 }}>
                <input type="checkbox" checked={withPct} onChange={e => setWithPct(e.target.checked)} />
                Tampilkan Persentase (%)
              </label>
              <button className="btn btn-primary" onClick={runPivot} disabled={pivotLoading || !pivotRow || !pivotVal}>
                {pivotLoading ? <RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <TrendingUp size={14} />}
                Buat Pivot
              </button>
            </>
          )}

          {((mode === 'freq' && freqResult) || (mode === 'pivot' && pivotResult)) && (
            <button className="btn btn-secondary btn-sm" onClick={downloadCSV} style={{ marginTop: 4 }}>
              <Download size={13} /> Download CSV
            </button>
          )}
        </div>

        {/* Result */}
        <div className="card">
          {/* FREQ RESULT */}
          {mode === 'freq' && freqResult && (
            <div>
              <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 12 }}>{freqResult.insight}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)' }}>{freqResult.field}</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>Count</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>Pct (%)</th>
                      <th style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>Proporsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freqResult.result.map(row => (
                      <tr key={row.value} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>{row.value}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{row.count.toLocaleString()}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)' }}>{row.pct}%</td>
                        <td style={{ padding: '6px 10px', minWidth: 100 }}>
                          <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${row.pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--purple))', borderRadius: 4 }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 700 }}>TOTAL</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{freqResult.total.toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>100%</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* PIVOT RESULT */}
          {mode === 'pivot' && pivotResult && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                {pivotResult.aggFunc.toUpperCase()} of <strong>{pivotResult.valueField}</strong> by <strong>{pivotResult.rowField}</strong>
                {pivotResult.colField && <> × <strong>{pivotResult.colField}</strong></>}
                {withPct && <span style={{ marginLeft: 8 }} className="badge badge-purple">+ %</span>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-secondary)' }}>{pivotResult.rowField}</th>
                      {pivotResult.colKeys.map(c => (
                        <th key={c} style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{c}</th>
                      ))}
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotResult.rowKeys.map(rk => (
                      <tr key={rk} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>{rk}</td>
                        {pivotResult.colKeys.map(ck => (
                          <td key={ck} style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {pivotResult.pivot[rk]?.[ck]?.toLocaleString() ?? '—'}
                            {withPct && pivotResult.pivotPct[rk]?.[ck] !== null && (
                              <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 5 }}>
                                {pivotResult.pivotPct[rk]?.[ck]}%
                              </span>
                            )}
                          </td>
                        ))}
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>
                          {pivotResult.pivot[rk]?.['__total__']?.toLocaleString() ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 700 }}>Grand Total</td>
                      {pivotResult.colKeys.map(ck => (
                        <td key={ck} style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                          {(pivotResult.grandTotal[ck] || 0).toLocaleString()}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {mode === 'freq' && !freqResult && !freqLoading && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 60 }}>
              Pilih kolom dan klik "Hitung Frekuensi"
            </div>
          )}
          {mode === 'pivot' && !pivotResult && !pivotLoading && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 60 }}>
              Konfigurasi pivot dan klik "Buat Pivot"
            </div>
          )}
          {(freqLoading || pivotLoading) && (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <RefreshCw size={28} style={{ color: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
