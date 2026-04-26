import { useState } from 'react'
import { Brain, RefreshCw, Copy, CheckCircle } from 'lucide-react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import type { ParsedData, AnalysisType } from './dataTypes'
import { useApp } from '../../context/AppContext'

interface Props { parsed: ParsedData }

export default function AIInsightTab({ parsed }: Props) {
  const { activeProject } = useApp()
  const [analysisType, setAnalysisType] = useState<AnalysisType>('general')
  const [result, setResult] = useState('')
  const [model, setModel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const run = async () => {
    setLoading(true); setResult(''); setError('')
    try {
      const res = await axios.post('/api/data/analyze', {
        fileName: parsed.fileName, headers: parsed.headers,
        stats: parsed.stats, sampleData: parsed.sampleForAI,
        analysisType, projectContext: activeProject?.name
      })
      setResult(res.data.data.text)
      setModel(res.data.data.model)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Analisis AI gagal')
    } finally { setLoading(false) }
  }

  const copy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const analysisOptions: [AnalysisType, string, string][] = [
    ['general', 'Umum & Komprehensif', 'Analisis menyeluruh semua variabel'],
    ['spatial', 'Distribusi Spasial', 'Pola keruangan dan cluster wilayah'],
    ['trend', 'Tren & Temporal', 'Pertumbuhan, penurunan, proyeksi'],
    ['regression', 'Regresi Linear (SPSS)', 'Identifikasi hubungan sebab-akibat (Y = a + bX)'],
    ['correlation', 'Uji Korelasi (Pearson)', 'Cari hubungan dan kekuatan antar variabel numerik'],
    ['descriptive', 'Statistik Deskriptif', 'Uji mean, variance, sebaran, dan kualitas numerik'],
    ['indicator', 'Evaluasi SNI & Benchmark', 'Bandingkan dengan standar pembangunan'],
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
      {/* Config */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'start' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Jenis Analisis AI
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {analysisOptions.map(([type, label, desc]) => (
            <div key={type} onClick={() => setAnalysisType(type)}
              style={{
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${analysisType === type ? 'var(--accent)' : 'var(--border)'}`,
                background: analysisType === type ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                transition: 'all 0.15s'
              }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: analysisType === type ? 'var(--accent)' : 'var(--text-primary)' }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
            </div>
          ))}
        </div>

        <div className="alert alert-info" style={{ fontSize: 11, margin: 0 }}>
          Menggunakan model AI terbaik yang tersedia (Qwen QwQ-32B → fallback otomatis).
        </div>

        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading
            ? <><RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Menganalisis...</>
            : <><Brain size={14} /> Analisis dengan AI</>
          }
        </button>
      </div>

      {/* Result */}
      <div className="card">
        {error && <div className="alert alert-error">{error}</div>}

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <RefreshCw size={32} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>AI sedang menganalisis dataset...</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>{parsed.rowCount.toLocaleString()} baris · {parsed.columnCount} kolom</div>
          </div>
        )}

        {!result && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Brain size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div>Pilih jenis analisis dan klik "Analisis dengan AI"</div>
          </div>
        )}

        {result && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Model: {model}</span>
              <button className="btn btn-secondary btn-sm" onClick={copy}>
                {copied ? <CheckCircle size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                {copied ? 'Tersalin!' : 'Salin'}
              </button>
            </div>
            <div className="markdown-output">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
