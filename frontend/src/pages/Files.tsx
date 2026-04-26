import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { Upload, Trash2, FileText, File, Image, Table, Download } from 'lucide-react'
import { apiGet, apiPost, apiDelete } from '../services/api'

interface FileMeta {
  id: string; projectId: string; originalName: string; storedName: string
  size: number; mimetype: string; uploadedAt: string; path: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getFileIcon(mime: string) {
  if (mime.startsWith('image/')) return { icon: Image, bg: '#1a2a1a', color: '#3fb950' }
  if (mime.includes('pdf')) return { icon: FileText, bg: '#2a1a1a', color: '#f85149' }
  if (mime.includes('sheet') || mime.includes('csv')) return { icon: Table, bg: '#1a2a1a', color: '#3fb950' }
  if (mime.includes('word')) return { icon: FileText, bg: '#1a1a2a', color: '#4f8ef7' }
  return { icon: File, bg: '#2a2a1a', color: '#d29922' }
}

export default function Files() {
  const { activeProject } = useApp()
  const { success, error: toastError, confirm } = useToast()
  const [files, setFiles] = useState<FileMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'uploading' | 'done' | 'error'>>({})
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadFiles = async () => {
    if (!activeProject) return
    setLoading(true)
    try {
      const result = await apiGet<FileMeta[]>(`/files/project/${activeProject.id}`)
      setFiles(result || [])
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFiles() }, [activeProject])

  const uploadFile = async (file: File) => {
    if (!activeProject) {
      toastError('Belum ada proyek aktif', 'Pilih proyek aktif terlebih dahulu')
      return false
    }

    setUploadProgress(prev => ({ ...prev, [file.name]: 'uploading' }))
    const fd = new FormData()
    fd.append('file', file)
    fd.append('projectId', activeProject.id)

    try {
      await apiPost('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadProgress(prev => ({ ...prev, [file.name]: 'done' }))
      return true
    } catch (error: any) {
      setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }))
      toastError('Gagal upload', error.message || file.name)
      return false
    }
  }

  const uploadFiles = async (fileList: FileList) => {
    setUploading(true)
    const arr = Array.from(fileList)
    let finished = 0
    for (const f of arr) {
      if (await uploadFile(f)) finished += 1
    }
    await loadFiles()
    setUploading(false)
    success(`${finished} dari ${arr.length} file berhasil diupload`, `Pengunggahan selesai`)
    setUploadProgress({})
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
  }

  const deleteFile = async (id: string, name: string) => {
    const ok = await confirm(`Hapus file "${name}"?`, 'File akan dihapus permanen dari server.')
    if (!ok) return
    try {
      await apiDelete(`/files/${id}`)
      await loadFiles()
      success('File dihapus', name)
    } catch {
      toastError('Gagal menghapus file', 'Coba lagi')
    }
  }

  const activeUploads = Object.entries(uploadProgress).filter(([, s]) => s === 'uploading')

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">Files</div>
          <div className="page-header-sub">
            {activeProject ? `Proyek: ${activeProject.name}` : 'Pilih proyek aktif untuk mengelola file'}
          </div>
        </div>
        {activeProject && (
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Upload file">
            <Upload size={14} /> {uploading ? `Mengunggah ${activeUploads.length} file...` : 'Upload File'}
          </button>
        )}
        <input
          ref={fileRef} type="file" style={{ display: 'none' }} multiple
          onChange={e => e.target.files && e.target.files.length > 0 && uploadFiles(e.target.files)}
          aria-hidden="true"
        />
      </div>

      <div className="page-content">
        {!activeProject ? (
          <div className="empty-state glass-panel" style={{ padding: '60px 20px', borderRadius: 'var(--radius-xl)' }}>
            <div className="empty-state-icon" style={{ fontSize: 64, marginBottom: 24, textShadow: '0 0 20px rgba(147, 197, 253, 0.4)' }}>📁</div>
            <h3 style={{ fontSize: 20 }}>Belum ada proyek aktif</h3>
            <p style={{ fontSize: 15, marginTop: 8 }}>Pilih atau buat proyek terlebih dahulu di halaman Projects untuk mulai mengunggah file.</p>
          </div>
        ) : (
          <>
            <div
              className={`upload-zone glass-panel ${dragOver ? 'drag-over' : ''}`}
              style={{ 
                marginBottom: 24, padding: '40px 20px', textAlign: 'center', borderRadius: 'var(--radius-xl)', 
                border: dragOver ? '2px dashed var(--accent)' : '2px dashed var(--border)',
                background: dragOver ? 'var(--accent-dim)' : 'rgba(0,0,0,0.2)',
                cursor: 'pointer', transition: 'var(--transition)'
              }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
              aria-label="Area upload file — drag drop atau klik"
            >
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(147, 197, 253, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--accent)' }}>
                <Upload size={32} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {uploading ? `Mengunggah ${activeUploads.length} file...` : 'Drag & drop file atau klik untuk browse'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                PDF, Word, Excel, Gambar, ZIP — bisa pilih beberapa sekaligus — maks. 50MB/file
              </div>
            </div>

            {/* Upload progress */}
            {Object.entries(uploadProgress).length > 0 && (
              <div className="glass-panel" style={{ marginBottom: 24, padding: 20, borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 12, letterSpacing: '1px' }}>PROGRESS UPLOAD</div>
                {Object.entries(uploadProgress).map(([name, status]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 13, flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: status === 'done' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--accent)' }}>
                      {status === 'uploading' ? '⏳ Uploading...' : status === 'done' ? '✓ Selesai' : '✕ Gagal'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div className="loading-overlay" aria-busy="true"><div className="spinner" /></div>
            ) : files.length === 0 ? (
              <div className="empty-state glass-panel" style={{ padding: '60px 20px', borderRadius: 'var(--radius-xl)' }}>
                <div className="empty-state-icon" style={{ fontSize: 56, marginBottom: 20, opacity: 0.5 }}>📄</div>
                <h3 style={{ fontSize: 18 }}>Belum ada file</h3>
                <p style={{ fontSize: 14, marginTop: 8 }}>Unggah dokumen, peta, data, atau laporan yang berkaitan dengan proyek ini.</p>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: 24, borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="section-header" style={{ marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                  <div className="section-title" style={{ fontSize: 16, fontWeight: 700 }}>{files.length} FileTersimpan</div>
                </div>
                {files.map(f => {
                  const { icon: Icon, bg, color } = getFileIcon(f.mimetype)
                  return (
                    <div key={f.id} className="file-item glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 'var(--radius-lg)', background: 'rgba(0,0,0,0.2)', transition: 'var(--transition)' }}>
                      <div className="file-icon" style={{ background: bg, width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={24} style={{ color }} />
                      </div>
                      <div className="file-info" style={{ flex: 1, minWidth: 0 }}>
                        <div className="file-name" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.originalName}</div>
                        <div className="file-meta" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {formatSize(f.size)} · {f.mimetype.split('/').pop()?.toUpperCase()} ·{' '}
                          {new Date(f.uploadedAt).toLocaleDateString('id-ID')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <a href={f.path} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary glass-panel" aria-label={`Buka ${f.originalName}`} style={{ padding: '8px 16px', borderRadius: 'var(--radius)' }}>
                          <Download size={14} /> Buka
                        </a>
                        <button
                          className="btn btn-sm btn-danger glass-panel"
                          onClick={() => deleteFile(f.id, f.originalName)}
                          aria-label={`Hapus ${f.originalName}`}
                          style={{ padding: '8px 12px', borderRadius: 'var(--radius)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
