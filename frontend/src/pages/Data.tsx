import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  FileSpreadsheet, BarChart2, Table, Brain, LineChart, PieChart, ScatterChart,
  SlidersHorizontal, Sigma, Database, CheckCircle2, Download, Copy, Eye, EyeOff
} from 'lucide-react'
import type { ParsedData } from './data/dataTypes'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import UploadTab from './data/UploadTab'
import VisualizeTab from './data/VisualizeTab'
import PivotTab from './data/PivotTab'
import AIInsightTab from './data/AIInsightTab'

type Tab = 'upload' | 'visualize' | 'pivot' | 'ai'
type Density = 'cozy' | 'compact'
type ExportFormat = 'png' | 'jpg'
type ChartTemplateId =
  | 'bar-compare' | 'bar-stacked' | 'line-trend' | 'area-trend'
  | 'pie-share' | 'donut-share' | 'scatter-rel' | 'bubble-rel'
  | 'histogram' | 'boxplot-lite' | 'heatmap-lite' | 'radar-compare'

const PREF_KEY = 'urbanmind_datacenter_prefs_v1'
const SAMPLE_LIMIT = 2000

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'upload', label: 'Upload Data', icon: <FileSpreadsheet size={14} /> },
  { key: 'visualize', label: 'Visualisasi', icon: <BarChart2 size={14} /> },
  { key: 'pivot', label: 'Pivot & Frek.', icon: <Table size={14} /> },
  { key: 'ai', label: 'AI Insight', icon: <Brain size={14} /> },
]

const CHART_TEMPLATES: { id: ChartTemplateId; label: string; desc: string; icon: ReactNode }[] = [
  { id: 'bar-compare', label: 'Bar Comparison', icon: <BarChart2 size={14} />, desc: 'Bandingkan kategori utama' },
  { id: 'bar-stacked', label: 'Stacked Bar', icon: <BarChart2 size={14} />, desc: 'Komposisi per kategori' },
  { id: 'line-trend', label: 'Line Trend', icon: <LineChart size={14} />, desc: 'Analisis tren waktu' },
  { id: 'area-trend', label: 'Area Trend', icon: <LineChart size={14} />, desc: 'Tren + volume' },
  { id: 'pie-share', label: 'Pie Share', icon: <PieChart size={14} />, desc: 'Proporsi komposisi' },
  { id: 'donut-share', label: 'Donut Share', icon: <PieChart size={14} />, desc: 'Komposisi modern' },
  { id: 'scatter-rel', label: 'Scatter Relation', icon: <ScatterChart size={14} />, desc: 'Hubungan variabel' },
  { id: 'bubble-rel', label: 'Bubble Relation', icon: <ScatterChart size={14} />, desc: 'Hubungan + skala' },
  { id: 'histogram', label: 'Histogram', icon: <Sigma size={14} />, desc: 'Distribusi numerik' },
  { id: 'boxplot-lite', label: 'Boxplot Lite', icon: <Sigma size={14} />, desc: 'Outlier & sebaran' },
  { id: 'heatmap-lite', label: 'Heatmap Lite', icon: <Database size={14} />, desc: 'Pola intensitas' },
  { id: 'radar-compare', label: 'Radar Compare', icon: <Database size={14} />, desc: 'Perbandingan multi-metrik' },
]

function toRows(parsed: ParsedData | null): Record<string, unknown>[] {
  if (!parsed) return []
  const p = parsed as any
  if (Array.isArray(p.rows)) return p.rows
  if (Array.isArray(p.data)) return p.data
  if (Array.isArray(p.records)) return p.records
  return []
}

function toColumns(parsed: ParsedData | null): string[] {
  if (!parsed) return []
  const p = parsed as any
  if (Array.isArray(p.columns)) return p.columns.map((c: any) => (typeof c === 'string' ? c : c?.name)).filter(Boolean)
  const rows = toRows(parsed)
  return rows[0] ? Object.keys(rows[0]) : []
}

function isNumericValue(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false
  return Number.isFinite(Number(v))
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export default function DataCenter() {
  const { dataFile, setDataFile } = useApp()
  const { success } = useToast()
  const parsed = dataFile as ParsedData | null

  const [tab, setTab] = useState<Tab>(dataFile ? 'visualize' : 'upload')
  const [density, setDensity] = useState<Density>('cozy')
  const [showTemplates, setShowTemplates] = useState(true)
  const [showQuickStats, setShowQuickStats] = useState(true)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY)
      if (!raw) return
      const prefs = JSON.parse(raw)
      if (prefs.density === 'cozy' || prefs.density === 'compact') setDensity(prefs.density)
      if (typeof prefs.showTemplates === 'boolean') setShowTemplates(prefs.showTemplates)
      if (typeof prefs.showQuickStats === 'boolean') setShowQuickStats(prefs.showQuickStats)
    } catch { }
  }, [])

  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify({ density, showTemplates, showQuickStats }))
  }, [density, showTemplates, showQuickStats])

  useEffect(() => {
    if (dataFile && tab === 'upload') setTab('visualize')
  }, [dataFile, tab])

  const switchTab = (newTab: Tab) => {
    setTab(newTab)
    if (newTab === 'visualize') setTimeout(() => window.dispatchEvent(new Event('resize')), 40)
  }

  const handleParsed = (data: ParsedData) => {
    setDataFile(data)
    switchTab('visualize')
  }

  const rows = useMemo(() => toRows(parsed), [parsed])
  const columns = useMemo(() => toColumns(parsed), [parsed])

  const stats = useMemo(() => {
    if (!parsed) return null
    const sample = rows.slice(0, SAMPLE_LIMIT)
    const colStats = columns.slice(0, 32).map((col) => {
      const vals = sample.map((r) => r[col])
      const nonEmpty = vals.filter((v) => v !== null && v !== undefined && v !== '')
      const nums = nonEmpty.filter(isNumericValue).map(Number)
      const missing = vals.length - nonEmpty.length
      return {
        col,
        missingPct: vals.length ? (missing / vals.length) * 100 : 0,
        numericRatio: nonEmpty.length ? (nums.length / nonEmpty.length) * 100 : 0,
        mean: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
        min: nums.length ? Math.min(...nums) : null,
        max: nums.length ? Math.max(...nums) : null,
        sd: nums.length ? stdDev(nums) : null,
      }
    })
    const numericCols = colStats.filter((c) => c.numericRatio >= 80)
    const qualityScore = colStats.length ? Math.round((colStats.filter((c) => c.missingPct < 5).length / colStats.length) * 100) : 0
    return { numericCount: numericCols.length, qualityScore, topNumeric: numericCols.slice(0, 8) }
  }, [parsed, rows, columns])

  const applyTemplate = (templateId: ChartTemplateId) => {
    switchTab('visualize')
    window.dispatchEvent(new CustomEvent('datacenter:apply-template', { detail: { templateId } }))
  }

  const exportChart = (format: ExportFormat, action: 'download' | 'copy') => {
    switchTab('visualize')
    window.dispatchEvent(new CustomEvent('datacenter:export-chart', { detail: { format, action } }))
    success('Permintaan dikirim', `${action === 'copy' ? 'Copy' : 'Download'} ${format.toUpperCase()} diproses`)
  }

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const total = TABS.length
    if (e.key === 'ArrowRight') { e.preventDefault(); tabRefs.current[(idx + 1) % total]?.focus() }
    if (e.key === 'ArrowLeft') { e.preventDefault(); tabRefs.current[(idx - 1 + total) % total]?.focus() }
    if (e.key === 'Home') { e.preventDefault(); tabRefs.current[0]?.focus() }
    if (e.key === 'End') { e.preventDefault(); tabRefs.current[total - 1]?.focus() }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTab(TABS[idx].key) }
  }

  return (
    <div className={`data-center density-${density}`}>
      <div className="page-header">
        <div>
          <div className="page-header-title">Data Center</div>
          <div className="page-header-sub">Analisis data modern: upload, visualisasi, pivot, statistik, AI insight</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setDensity((d) => (d === 'cozy' ? 'compact' : 'cozy'))} aria-pressed={density === 'compact'}>
            <SlidersHorizontal size={14} /> {density === 'cozy' ? 'Compact' : 'Cozy'}
          </button>

          <button className="btn btn-ghost btn-sm" onClick={() => setShowTemplates((v) => !v)} aria-pressed={showTemplates}>
            {showTemplates ? <EyeOff size={14} /> : <Eye size={14} />} Templates
          </button>

          <button className="btn btn-ghost btn-sm" onClick={() => setShowQuickStats((v) => !v)} aria-pressed={showQuickStats}>
            {showQuickStats ? <EyeOff size={14} /> : <Eye size={14} />} Quick Stats
          </button>

          {parsed && (
            <>
              <span className="badge badge-green">{parsed.fileName}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {parsed.rowCount.toLocaleString()} baris · {parsed.columnCount} kolom
              </span>
              {stats && <span className="badge badge-blue"><CheckCircle2 size={12} style={{ marginRight: 4 }} />Quality {stats.qualityScore}%</span>}

              <button className="btn btn-secondary btn-sm" onClick={() => exportChart('png', 'download')}><Download size={14} /> PNG</button>
              <button className="btn btn-secondary btn-sm" onClick={() => exportChart('jpg', 'download')}><Download size={14} /> JPG</button>
              <button className="btn btn-secondary btn-sm" onClick={() => exportChart('png', 'copy')}><Copy size={14} /> Copy PNG</button>

              <button className="btn btn-ghost btn-sm" onClick={() => { setDataFile(null); setTab('upload') }}>
                ✕ Ganti File
              </button>
            </>
          )}
        </div>
      </div>

      <div className="page-content">
        <div role="tablist" aria-label="Data center tabs" style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', overflowX: 'auto', paddingBottom: 8 }}>
          {TABS.map(({ key, label, icon }, i) => (
            <button
              key={key}
              ref={(el) => { tabRefs.current[i] = el }}
              role="tab"
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              id={`tab-${key}`}
              tabIndex={tab === key ? 0 : -1}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              onClick={() => switchTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: density === 'compact' ? '8px 16px' : '10px 20px',
                background: tab === key ? 'rgba(147, 197, 253, 0.1)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: tab === key ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: '8px 8px 0 0', transition: 'var(--transition)'
              }}
            >
              {icon} {label}
              {key !== 'upload' && !parsed && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(upload dulu)</span>}
            </button>
          ))}
        </div>

        {parsed && showTemplates && (
          <div className="glass-panel" style={{ marginBottom: 20, padding: 20, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>✦</span> Template Chart Cepat
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              {CHART_TEMPLATES.map((t) => (
                <button key={t.id} className="btn btn-secondary glass-panel" style={{ justifyContent: 'flex-start', height: 'auto', padding: '12px 16px', textAlign: 'left', background: 'rgba(0,0,0,0.2)' }} onClick={() => applyTemplate(t.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(147, 197, 253, 0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {t.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {parsed && stats && showQuickStats && (
          <div className="card" style={{ marginBottom: 16, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sigma size={14} />
              <strong style={{ fontSize: 13 }}>Quick Stats (Ringan)</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8, marginBottom: 10 }}>
              <div className="badge badge-blue">Numeric: {stats.numericCount}</div>
              <div className="badge badge-green">Quality: {stats.qualityScore}%</div>
              <div className="badge">Sample: {Math.min(rows.length, SAMPLE_LIMIT).toLocaleString()} rows</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Kolom', '% Missing', '% Numeric', 'Mean', 'Min', 'Max', 'Std Dev'].map((h) => (
                      <th key={h} style={{ textAlign: h === 'Kolom' ? 'left' : 'right', padding: 6, borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.topNumeric.map((c) => (
                    <tr key={c.col}>
                      <td style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>{c.col}</td>
                      <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{c.missingPct.toFixed(1)}%</td>
                      <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{c.numericRatio.toFixed(1)}%</td>
                      <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{c.mean?.toFixed(2) ?? '-'}</td>
                      <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{c.min?.toFixed(2) ?? '-'}</td>
                      <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{c.max?.toFixed(2) ?? '-'}</td>
                      <td style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{c.sd?.toFixed(2) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div id="panel-upload" role="tabpanel" aria-labelledby="tab-upload" style={{ display: tab === 'upload' ? 'block' : 'none' }}>
          <UploadTab onParsed={handleParsed} />
        </div>

        {tab !== 'upload' && !parsed && (
          <div className="card" style={{ textAlign: 'center', padding: 56 }}>
            <FileSpreadsheet size={40} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.45 }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Upload file data terlebih dahulu</div>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setTab('upload')}>Ke Upload Data</button>
          </div>
        )}

        {parsed && (
          <>
            <div id="panel-visualize" role="tabpanel" aria-labelledby="tab-visualize" style={{ display: tab === 'visualize' ? 'block' : 'none' }}>
              <VisualizeTab parsed={parsed} />
            </div>
            <div id="panel-pivot" role="tabpanel" aria-labelledby="tab-pivot" style={{ display: tab === 'pivot' ? 'block' : 'none' }}>
              <PivotTab parsed={parsed} />
            </div>
            <div id="panel-ai" role="tabpanel" aria-labelledby="tab-ai" style={{ display: tab === 'ai' ? 'block' : 'none' }}>
              <AIInsightTab parsed={parsed} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
