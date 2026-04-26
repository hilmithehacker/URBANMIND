import { useRef, useState, useCallback, type DragEvent } from 'react'
import { Upload, FileSpreadsheet, RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react'
import axios from 'axios'
import type { ParsedData } from './dataTypes'

interface Props {
  onParsed: (data: ParsedData) => void
}

export default function UploadTab({ onParsed }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [storedFile, setStoredFile] = useState<File | null>(null)

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true); setError(''); setParsed(null)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await axios.post('/api/data/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const d = res.data.data as ParsedData
      setParsed(d)
      setStoredFile(file)
      onParsed(d)
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || 'Gagal membaca file'
      setError(msg)
    } finally { setUploading(false) }
  }, [onParsed])

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleSheetChange = async (sheetIndex: number) => {
    if (!storedFile) return
    setUploading(true); setError('')
    const fd = new FormData()
    fd.append('file', storedFile)
    fd.append('sheetIndex', String(sheetIndex))
    try {
      const res = await axios.post('/api/data/sheet', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const d = res.data.data as ParsedData
      setParsed(d); onParsed(d)
    } catch (e: any) { setError(e.response?.data?.error || 'Gagal ganti sheet') }
    finally { setUploading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12, padding: '48px 20px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'var(--accent-dim)' : 'var(--bg-secondary)',
          transition: 'all 0.2s'
        }}
      >
        {uploading
          ? <RefreshCw size={36} style={{ color: 'var(--accent)', marginBottom: 10, animation: 'spin 0.8s linear infinite' }} />
          : <Upload size={36} style={{ color: 'var(--accent)', marginBottom: 10 }} />
        }
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
          {uploading ? 'Membaca file...' : 'Drop file atau klik untuk upload'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          CSV · XLSX · XLS · DBF — maks 30 MB
        </div>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.dbf,.ods"
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div><strong>Upload gagal:</strong> {error}</div>
        </div>
      )}

      {/* Success + metadata */}
      {parsed && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} style={{ color: 'var(--success)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{parsed.fileName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {parsed.rowCount.toLocaleString()} baris · {parsed.columnCount} kolom
                  {parsed.sheetName && ` · Sheet: ${parsed.sheetName}`}
                  <span style={{ marginLeft: 8 }} className="badge badge-blue">{parsed.fileType}</span>
                </div>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowStats(s => !s)}>
              {showStats ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Statistik
            </button>
          </div>

          {/* Sheet selector for Excel */}
          {parsed.sheets && parsed.sheets.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sheet:</span>
              {parsed.sheets.map((s, i) => (
                <button key={s} onClick={() => handleSheetChange(i)}
                  style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, border: '1px solid var(--border)',
                    background: parsed.sheetName === s ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: parsed.sheetName === s ? '#fff' : 'var(--text-secondary)', cursor: 'pointer'
                  }}>{s}</button>
              ))}
            </div>
          )}

          {/* Auto insight */}
          {parsed.autoInsight && (
            <div className="alert alert-info" style={{ fontSize: 12, margin: 0 }}>
              <FileSpreadsheet size={14} style={{ flexShrink: 0 }} />
              <div style={{ whiteSpace: 'pre-line' }}>{parsed.autoInsight.replace(/\*\*/g, '')}</div>
            </div>
          )}

          {/* Column stats table */}
          {showStats && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)' }}>
                    {['Kolom', 'Tipe', 'Count', 'Missing', 'Min/Unique', 'Max/Top Value', 'Mean/Std'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map(col => {
                    const s = parsed.stats[col]
                    return (
                      <tr key={col} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span className={`badge ${s.type === 'numeric' ? 'badge-blue' : 'badge-green'}`}>{s.type}</span>
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{s.count}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: s.missing > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                          {s.missing > 0 ? `⚠️ ${s.missing}` : '0'}
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{s.type === 'numeric' ? s.min : s.unique}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.type === 'numeric' ? s.max : s.topValues?.[0]?.value}
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                          {s.type === 'numeric' ? `${s.mean} / ${s.std}` : `${s.topValues?.[0]?.pct}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Data preview */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
              PREVIEW ({Math.min(parsed.preview.length, 50)} baris pertama)
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary)', zIndex: 1 }}>
                  <tr>
                    {parsed.headers.map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.preview.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      {parsed.headers.map(h => (
                        <td key={h} style={{ padding: '4px 8px', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {String(row[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
