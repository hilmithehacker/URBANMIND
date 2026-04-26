import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, type ChartOptions
} from 'chart.js'
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2'
import { Download, Copy, RefreshCw, Settings2, CheckCircle } from 'lucide-react'
import type { ParsedData, ChartConfig } from './dataTypes'
import { CHART_COLORS, DEFAULT_CHART_CONFIG } from './dataTypes'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend)

interface Props { parsed: ParsedData }

function buildDataset(parsed: ParsedData, cfg: ChartConfig) {
  const { xCol, yCol, sortDir, topN, type } = cfg
  if (!xCol || !yCol) return null

  let rows = [...parsed.preview]

  // Sort
  if (sortDir !== 'none') {
    rows.sort((a, b) => {
      const va = Number(a[yCol]) || 0, vb = Number(b[yCol]) || 0
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }

  // Top N
  if (topN > 0 && topN < rows.length) rows = rows.slice(0, topN)

  const labels = rows.map(r => String(r[xCol] ?? ''))
  const values = rows.map(r => Number(r[yCol]) || 0)
  const bgColors = type === 'bar' || type === 'horizontalBar' || type === 'stackedBar'
    ? cfg.color
    : CHART_COLORS.slice(0, labels.length)

  if (type === 'pie' || type === 'doughnut') {
    return { labels, datasets: [{ data: values, backgroundColor: CHART_COLORS, borderWidth: 1 }] }
  }
  return {
    labels,
    datasets: [{
      label: yCol,
      data: values,
      backgroundColor: bgColors + '99',
      borderColor: bgColors,
      borderWidth: 2,
      tension: 0.35,
      fill: type === 'line' ? false : undefined,
      stack: type === 'stackedBar' ? 'stack0' : undefined
    }]
  }
}

function buildOptions(cfg: ChartConfig): ChartOptions<any> {
  const isHoriz = cfg.type === 'horizontalBar'
  const isPie = cfg.type === 'pie' || cfg.type === 'doughnut'
  const isStacked = cfg.type === 'stackedBar'
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: isHoriz ? 'y' : 'x',
    plugins: {
      legend: { labels: { color: '#e2e8f0', font: { size: 12 } } },
      title: cfg.title ? { display: true, text: cfg.title, color: '#e6edf3', font: { size: 14, weight: 'bold' } } : { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed?.y ?? ctx.parsed?.x ?? ctx.raw
            return ` ${ctx.dataset.label || ctx.label}: ${Number(val).toLocaleString()}`
          }
        }
      },
      datalabels: undefined
    },
    scales: isPie ? {} : {
      x: {
        stacked: isStacked,
        ticks: { color: '#94a3b8', maxRotation: 45 },
        grid: { color: 'rgba(255,255,255,0.04)' }
      },
      y: {
        stacked: isStacked,
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.06)' }
      }
    }
  }
}

export default function VisualizeTab({ parsed }: Props) {
  const chartRef = useRef<any>(null)
  const [cfg, setCfg] = useState<ChartConfig>(() => {
    const numCols = parsed.headers.filter(h => parsed.stats[h]?.type === 'numeric')
    const catCols = parsed.headers.filter(h => parsed.stats[h]?.type === 'categorical')
    return {
      ...DEFAULT_CHART_CONFIG,
      xCol: catCols[0] || parsed.headers[0] || '',
      yCol: numCols[0] || parsed.headers[1] || '',
      title: parsed.fileName.replace(/\.[^.]+$/, '')
    }
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const numCols = parsed.headers.filter(h => parsed.stats[h]?.type === 'numeric')
    const catCols = parsed.headers.filter(h => parsed.stats[h]?.type === 'categorical')
    setCfg(c => ({
      ...c,
      xCol: catCols[0] || parsed.headers[0] || '',
      yCol: numCols[0] || parsed.headers[1] || '',
      title: parsed.fileName.replace(/\.[^.]+$/, '')
    }))
  }, [parsed])

  useEffect(() => {
    const handleTemplate = (e: any) => {
      const t = e.detail.templateId
      const numCols = parsed.headers.filter(h => parsed.stats[h]?.type === 'numeric')
      const catCols = parsed.headers.filter(h => parsed.stats[h]?.type === 'categorical')
      const c1 = catCols[0] || parsed.headers[0]
      const n1 = numCols[0] || parsed.headers[1]
      const n2 = numCols[1] || numCols[0] || parsed.headers[2]

      if (t === 'bar-compare') setCfg(c => ({ ...c, type: 'bar', xCol: c1, yCol: n1, sortDir: 'desc' }))
      if (t === 'line-trend') setCfg(c => ({ ...c, type: 'line', xCol: c1, yCol: n1, sortDir: 'none' }))
      if (t === 'pie-share') setCfg(c => ({ ...c, type: 'pie', xCol: c1, yCol: n1, sortDir: 'desc', topN: 7 }))
      if (t === 'scatter-rel') setCfg(c => ({ ...c, type: 'line', xCol: n1, yCol: n2, sortDir: 'none' })) // As line for now
      if (t === 'histogram') setCfg(c => ({ ...c, type: 'bar', xCol: n1, yCol: n1, sortDir: 'asc' })) 
      if (t === 'heatmap-lite') setCfg(c => ({ ...c, type: 'horizontalBar', xCol: c1, yCol: n1, sortDir: 'desc' }))
    }
    window.addEventListener('datacenter:apply-template', handleTemplate)
    return () => window.removeEventListener('datacenter:apply-template', handleTemplate)
  }, [parsed])

  const set = useCallback(<K extends keyof ChartConfig>(k: K, v: ChartConfig[K]) =>
    setCfg(c => ({ ...c, [k]: v })), [])

  const downloadChart = (format: 'png' | 'svg') => {
    const chart = chartRef.current
    if (!chart) return
    const canvas = chart.canvas as HTMLCanvasElement
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${cfg.title || 'chart'}.${format === 'svg' ? 'png' : format}`
    a.click()
  }

  const copyChart = async () => {
    const chart = chartRef.current
    if (!chart) return
    const canvas = chart.canvas as HTMLCanvasElement
    try {
      canvas.toBlob(async blob => {
        if (!blob) return
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setCopied(true); setTimeout(() => setCopied(false), 2000)
      })
    } catch {
      // Fallback: download instead
      downloadChart('png')
    }
  }

  const data = buildDataset(parsed, cfg)
  const options = buildOptions(cfg)

  const chartTypes = [
    ['bar', 'Bar'], ['horizontalBar', 'H-Bar'], ['line', 'Line'],
    ['pie', 'Pie'], ['doughnut', 'Donut'], ['stackedBar', 'Stacked']
  ] as const

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
      {/* Config panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            <Settings2 size={13} /> Konfigurasi Chart
          </div>

          {/* Chart type buttons */}
          <div style={{ marginBottom: 12 }}>
            <div className="form-label">Jenis Chart</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {chartTypes.map(([type, label]) => (
                <button key={type} onClick={() => set('type', type)}
                  style={{
                    padding: '5px 4px', fontSize: 11, border: '1px solid var(--border)',
                    borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                    background: cfg.type === type ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: cfg.type === type ? '#fff' : 'var(--text-secondary)'
                  }}>{label}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Sumbu X / Label</label>
            <select className="form-input" value={cfg.xCol} onChange={e => set('xCol', e.target.value)}>
              {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Sumbu Y / Nilai</label>
            <select className="form-input" value={cfg.yCol} onChange={e => set('yCol', e.target.value)}>
              {parsed.headers.filter(h => parsed.stats[h]?.type === 'numeric').map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Judul Chart</label>
            <input className="form-input" value={cfg.title} onChange={e => set('title', e.target.value)} placeholder="Judul grafik..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div>
              <label className="form-label">Urutan</label>
              <select className="form-input" value={cfg.sortDir} onChange={e => set('sortDir', e.target.value as any)}>
                <option value="none">Default</option>
                <option value="desc">Desc ↓</option>
                <option value="asc">Asc ↑</option>
              </select>
            </div>
            <div>
              <label className="form-label">Top N</label>
              <input className="form-input" type="number" min={0} max={200} value={cfg.topN}
                onChange={e => set('topN', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Warna</label>
            <input type="color" value={cfg.color} onChange={e => set('color', e.target.value)}
              style={{ width: 36, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
          </div>
        </div>

        {/* Export buttons */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Export</div>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadChart('png')} style={{ width: '100%', justifyContent: 'center' }}>
            <Download size={13} /> Download PNG
          </button>
          <button className="btn btn-secondary btn-sm" onClick={copyChart} style={{ width: '100%', justifyContent: 'center' }}>
            {copied ? <CheckCircle size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
            {copied ? 'Tersalin!' : 'Copy ke Clipboard'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCfg(c => ({ ...DEFAULT_CHART_CONFIG, xCol: c.xCol, yCol: c.yCol, title: c.title }))}
            style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}>
            <RefreshCw size={12} /> Reset Config
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="card">
        <div style={{ height: 420 }}>
          {!data ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 100 }}>
              Pilih kolom X dan Y untuk visualisasi
            </div>
          ) : (
            <>
              {cfg.type === 'bar' && <Bar ref={chartRef} data={data} options={options} />}
              {cfg.type === 'horizontalBar' && <Bar ref={chartRef} data={data} options={options} />}
              {cfg.type === 'line' && <Line ref={chartRef} data={data} options={options} />}
              {cfg.type === 'pie' && <Pie ref={chartRef} data={data} options={options} />}
              {cfg.type === 'doughnut' && <Doughnut ref={chartRef} data={data} options={options} />}
              {cfg.type === 'stackedBar' && <Bar ref={chartRef} data={data} options={options} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
